import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId, newToken } from "@/lib/ids";
import { DomainError } from "@/lib/errors";
import { limits } from "@/lib/config";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { loadEntitlement } from "@/lib/billing/load";
import type { Actor } from "@/lib/cards/service";
import { storage } from "./storage";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export type MediaPurpose = "image" | "document";

export interface ProcessedFile {
  kind: "image" | "document";
  mimeType: string;
  body: Buffer;
  width: number | null;
  height: number | null;
}

/**
 * Valide le type RÉEL (signature binaire, pas l'extension ni l'en-tête du navigateur),
 * la taille et les dimensions. Les images sont ré-encodées : métadonnées (EXIF, GPS…)
 * supprimées, orientation appliquée, taille réduite. SVG, HTML et autres types actifs
 * sont refusés.
 */
export async function processUpload(input: Buffer, purpose: MediaPurpose): Promise<ProcessedFile> {
  if (input.length === 0) throw new DomainError("invalid", "Fichier vide.");
  const detected = await fileTypeFromBuffer(input);

  if (purpose === "image") {
    if (input.length > limits.imageMaxBytes) throw new DomainError("invalid", `Image trop lourde (maximum ${limits.imageMaxBytes / 1024 / 1024} Mo).`);
    if (!detected || !IMAGE_TYPES.has(detected.mime)) throw new DomainError("invalid", "Format d'image non accepté. Utilisez JPEG, PNG, WebP ou AVIF.");
    let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
    try {
      meta = await sharp(input, { limitInputPixels: limits.imageMaxPixels }).metadata();
    } catch {
      throw new DomainError("invalid", "Image illisible ou trop grande.");
    }
    if (!meta.width || !meta.height || meta.width > limits.imageMaxDimension || meta.height > limits.imageMaxDimension) {
      throw new DomainError("invalid", `Dimensions maximales : ${limits.imageMaxDimension} × ${limits.imageMaxDimension} pixels.`);
    }
    const { data, info } = await sharp(input, { limitInputPixels: limits.imageMaxPixels })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { kind: "image", mimeType: "image/webp", body: data, width: info.width, height: info.height };
  }

  if (input.length > limits.pdfMaxBytes) throw new DomainError("invalid", `Document trop lourd (maximum ${limits.pdfMaxBytes / 1024 / 1024} Mo).`);
  const tail = input.subarray(Math.max(0, input.length - 2048)).toString("latin1");
  if (!detected || detected.mime !== "application/pdf" || !input.subarray(0, 5).toString("latin1").startsWith("%PDF-") || !tail.includes("%%EOF")) {
    throw new DomainError("invalid", "Seuls les documents PDF sont acceptés.");
  }
  return { kind: "document", mimeType: "application/pdf", body: input, width: null, height: null };
}

export function sanitizeFileName(name: string, fallback: string): string {
  const cleaned = name
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

export async function uploadMedia(actor: Actor, file: { buffer: Buffer; name: string }, purpose: MediaPurpose) {
  if (!can(actor, "media.upload")) throw new DomainError("forbidden", "Envoi de fichiers non autorisé.");
  const processed = await processUpload(file.buffer, purpose);
  const id = newId();
  const ext = processed.kind === "image" ? "webp" : "pdf";
  // Clé aléatoire : aucune information issue du nom d'origine.
  const storageKey = `org/${actor.organization.id}/${newToken(16)}.${ext}`;
  const originalName = sanitizeFileName(file.name, processed.kind === "image" ? "image.webp" : "document.pdf");

  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${schema.organization} where id = ${actor.organization.id} for update`);
    const ent = await loadEntitlement(actor.organization.id, tx);
    if (!ent.canEdit) throw new DomainError("entitlement", "Envoi de fichiers suspendu pour cette organisation.");
    const [used] = await tx
      .select({ bytes: sql<number>`coalesce(sum(${schema.mediaAsset.sizeBytes}), 0)::bigint` })
      .from(schema.mediaAsset)
      .where(and(eq(schema.mediaAsset.organizationId, actor.organization.id), isNull(schema.mediaAsset.deletedAt)));
    const quotaBytes = ent.quotas.storageMb * 1024 * 1024;
    if (Number(used?.bytes ?? 0) + processed.body.length > quotaBytes) {
      throw new DomainError("quota_exceeded", `Espace de stockage insuffisant (${ent.quotas.storageMb} Mo inclus).`);
    }
    await tx.insert(schema.mediaAsset).values({
      id,
      organizationId: actor.organization.id,
      kind: processed.kind,
      mimeType: processed.mimeType,
      storageKey,
      originalName,
      sizeBytes: processed.body.length,
      width: processed.width,
      height: processed.height,
      uploadedById: actor.user.id,
    });
    // Écriture du fichier dans la transaction : si elle échoue, la ligne est annulée.
    await storage().put(storageKey, processed.body, processed.mimeType);
  });
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: actor.supportGrantId ? "staff" : "user", supportGrantId: actor.supportGrantId, action: "media.upload", targetType: "media", targetId: id });
  return { id, kind: processed.kind, mimeType: processed.mimeType, sizeBytes: processed.body.length, width: processed.width, height: processed.height, originalName };
}

/**
 * Upload d'une photo jointe à une demande de contact, par un VISITEUR anonyme (aucun compte).
 * Sécurité : type réel vérifié + ré-encodage (EXIF supprimé), quota de l'organisation respecté,
 * marquée source="lead" (hors médiathèque, non supprimable via l'écran Médias). L'appelant doit
 * avoir validé en amont que la carte est accessible et que son formulaire autorise les photos,
 * et appliquer une limitation de débit.
 */
export async function uploadLeadPhoto(organizationId: string, buffer: Buffer): Promise<string> {
  const processed = await processUpload(buffer, "image");
  const id = newId();
  const storageKey = `org/${organizationId}/lead/${newToken(16)}.webp`;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${schema.organization} where id = ${organizationId} for update`);
    const ent = await loadEntitlement(organizationId, tx);
    if (!ent.publicAccess) throw new DomainError("entitlement", "Cette carte n'est plus disponible.");
    const [used] = await tx
      .select({ bytes: sql<number>`coalesce(sum(${schema.mediaAsset.sizeBytes}), 0)::bigint` })
      .from(schema.mediaAsset)
      .where(and(eq(schema.mediaAsset.organizationId, organizationId), isNull(schema.mediaAsset.deletedAt)));
    if (Number(used?.bytes ?? 0) + processed.body.length > ent.quotas.storageMb * 1024 * 1024) {
      throw new DomainError("quota_exceeded", "Espace de stockage insuffisant pour recevoir la photo.");
    }
    await tx.insert(schema.mediaAsset).values({
      id,
      organizationId,
      kind: "image",
      mimeType: processed.mimeType,
      storageKey,
      originalName: "photo-prospect.webp",
      sizeBytes: processed.body.length,
      width: processed.width,
      height: processed.height,
      uploadedById: null,
      source: "lead",
    });
    await storage().put(storageKey, processed.body, processed.mimeType);
  });
  return id;
}

/** Lecture privée d'un média : réservée aux membres de l'organisation propriétaire. */
export async function getMediaForActor(actor: Actor, mediaId: string) {
  const [m] = await db
    .select()
    .from(schema.mediaAsset)
    .where(and(eq(schema.mediaAsset.id, mediaId), eq(schema.mediaAsset.organizationId, actor.organization.id), isNull(schema.mediaAsset.deletedAt)));
  if (!m) throw new DomainError("not_found", "Média introuvable");
  return m;
}

export async function listMedia(actor: Actor) {
  return db
    .select()
    .from(schema.mediaAsset)
    .where(and(eq(schema.mediaAsset.organizationId, actor.organization.id), isNull(schema.mediaAsset.deletedAt), isNull(schema.mediaAsset.source)))
    .orderBy(sql`${schema.mediaAsset.createdAt} desc`)
    .limit(300);
}

/**
 * Suppression logique immédiate (le média cesse d'être servi), puis suppression du
 * fichier. Refusée si une version publiée l'utilise encore.
 */
export async function deleteMedia(actor: Actor, mediaId: string) {
  if (!can(actor, "cards.manageAll")) throw new DomainError("forbidden", "Action réservée aux gestionnaires.");
  const media = await getMediaForActor(actor, mediaId);
  const [used] = await db
    .select({ id: schema.card.id })
    .from(schema.card)
    .innerJoin(schema.cardVersion, eq(schema.cardVersion.id, schema.card.publishedVersionId))
    .where(and(eq(schema.card.organizationId, actor.organization.id), eq(schema.card.status, "published"), sql`${schema.cardVersion.mediaIds} @> ${JSON.stringify([mediaId])}::jsonb`))
    .limit(1);
  if (used) throw new DomainError("invalid", "Ce fichier est utilisé par une carte publiée. Retirez-le de la carte puis republiez-la.");
  await db.update(schema.mediaAsset).set({ deletedAt: new Date() }).where(eq(schema.mediaAsset.id, media.id));
  await storage().delete(media.storageKey);
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "media.delete", targetType: "media", targetId: mediaId });
}
