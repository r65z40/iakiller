import { cache } from "react";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { loadEntitlement } from "@/lib/billing/load";
import { parseDocument, type CardDocument } from "./document";
import { applyBrandLocks } from "@/lib/brand";
import { getBrand } from "@/lib/brand-service";

export type PublicCardResult =
  | { kind: "ok"; organization: typeof schema.organization.$inferSelect; card: typeof schema.card.$inferSelect; document: CardDocument; versionId: string }
  | { kind: "redirect"; path: string }
  | { kind: "unavailable" }
  | { kind: "not_found" };

/**
 * Une carte est publiquement accessible si et seulement si :
 * publiée + version publiée + non désactivée + non suspendue + organisation non supprimée
 * + droits d'organisation actifs (essai ou abonnement) calculés À CET INSTANT.
 */
export async function isCardPubliclyAccessible(card: typeof schema.card.$inferSelect, now = new Date()) {
  if (card.status !== "published" || !card.publishedVersionId) return false;
  if (card.disabledAt || card.adminSuspendedAt) return false;
  const ent = await loadEntitlement(card.organizationId, db, now);
  return ent.publicAccess;
}

async function loadAccessible(org: typeof schema.organization.$inferSelect, card: typeof schema.card.$inferSelect): Promise<PublicCardResult> {
  if (org.deletedAt) return { kind: "not_found" };
  if (!(await isCardPubliclyAccessible(card))) return { kind: "unavailable" };
  const [[version], brand] = await Promise.all([
    db
      .select()
      .from(schema.cardVersion)
      .where(and(eq(schema.cardVersion.id, card.publishedVersionId!), eq(schema.cardVersion.cardId, card.id))),
    getBrand(org.id),
  ]);
  if (!version) return { kind: "unavailable" };
  const parsed = parseDocument(version.document);
  if (!parsed.success) return { kind: "unavailable" };
  // Les verrous de marque s'appliquent aussi au rendu : un changement de charte par le
  // propriétaire est visible immédiatement sur toutes les cartes publiées.
  const document = applyBrandLocks(parsed.data, brand);
  return { kind: "ok", organization: org, card, document, versionId: version.id };
}

export async function resolvePublicCard(orgSlug: string, cardSlug: string): Promise<PublicCardResult> {
  const [org] = await db.select().from(schema.organization).where(and(eq(schema.organization.slug, orgSlug), isNull(schema.organization.deletedAt)));
  if (!org) {
    const [redir] = await db
      .select({ organizationId: schema.slugRedirect.organizationId })
      .from(schema.slugRedirect)
      .where(and(eq(schema.slugRedirect.kind, "organization"), eq(schema.slugRedirect.oldSlug, orgSlug)));
    if (!redir) return { kind: "not_found" };
    const [target] = await db.select({ slug: schema.organization.slug, deletedAt: schema.organization.deletedAt }).from(schema.organization).where(eq(schema.organization.id, redir.organizationId));
    if (!target || target.deletedAt) return { kind: "not_found" };
    return { kind: "redirect", path: `/${target.slug}/${cardSlug}` };
  }

  const [card] = await db.select().from(schema.card).where(and(eq(schema.card.organizationId, org.id), eq(schema.card.slug, cardSlug)));
  if (!card) {
    const [redir] = await db
      .select({ cardId: schema.slugRedirect.cardId })
      .from(schema.slugRedirect)
      .where(and(eq(schema.slugRedirect.kind, "card"), eq(schema.slugRedirect.organizationId, org.id), eq(schema.slugRedirect.oldSlug, cardSlug)));
    if (!redir?.cardId) return { kind: "not_found" };
    const [target] = await db.select({ slug: schema.card.slug }).from(schema.card).where(and(eq(schema.card.id, redir.cardId), eq(schema.card.organizationId, org.id)));
    if (!target) return { kind: "not_found" };
    return { kind: "redirect", path: `/${org.slug}/${target.slug}` };
  }
  return loadAccessible(org, card);
}

/**
 * Variante mémorisée le temps d'une requête : la page et ses métadonnées résolvent
 * la même carte une seule fois (droits recalculés à chaque nouvelle requête).
 */
export const resolvePublicCardForRequest = cache(resolvePublicCard);

/** Résout le jeton stable du QR code vers l'adresse courante de la carte. */
export async function resolvePublicToken(token: string): Promise<{ kind: "redirect"; path: string } | { kind: "unavailable" } | { kind: "not_found" }> {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return { kind: "not_found" };
  const [row] = await db
    .select({ card: schema.card, org: schema.organization })
    .from(schema.card)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.card.organizationId))
    .where(eq(schema.card.publicToken, token));
  if (!row || row.org.deletedAt) return { kind: "not_found" };
  if (!(await isCardPubliclyAccessible(row.card))) return { kind: "unavailable" };
  return { kind: "redirect", path: `/${row.org.slug}/${row.card.slug}` };
}

/**
 * Un média n'est servi publiquement que s'il est référencé par la version PUBLIÉE d'au
 * moins une carte actuellement accessible de sa propre organisation.
 */
export async function isMediaPubliclyServable(mediaId: string): Promise<{ ok: boolean; media?: typeof schema.mediaAsset.$inferSelect }> {
  const [media] = await db.select().from(schema.mediaAsset).where(and(eq(schema.mediaAsset.id, mediaId), isNull(schema.mediaAsset.deletedAt)));
  if (!media) return { ok: false };
  const candidates = await db
    .select({ card: schema.card })
    .from(schema.card)
    .innerJoin(schema.cardVersion, eq(schema.cardVersion.id, schema.card.publishedVersionId))
    .where(
      and(
        eq(schema.card.organizationId, media.organizationId),
        eq(schema.cardVersion.organizationId, media.organizationId),
        eq(schema.card.status, "published"),
        isNull(schema.card.disabledAt),
        isNull(schema.card.adminSuspendedAt),
        sql`${schema.cardVersion.mediaIds} @> ${JSON.stringify([mediaId])}::jsonb`,
      ),
    )
    .limit(1);
  if (candidates.length === 0) {
    // Logo de marque verrouillé : servi s'il existe au moins une carte accessible de l'organisation.
    const brand = await getBrand(media.organizationId);
    if (!(brand?.logoMediaId === mediaId && brand.lockedFields.includes("logo"))) return { ok: false };
    const [anyCard] = await db
      .select({ id: schema.card.id })
      .from(schema.card)
      .where(and(eq(schema.card.organizationId, media.organizationId), eq(schema.card.status, "published"), isNull(schema.card.disabledAt), isNull(schema.card.adminSuspendedAt)))
      .limit(1);
    if (!anyCard) return { ok: false };
  }
  const ent = await loadEntitlement(media.organizationId);
  return ent.publicAccess ? { ok: true, media } : { ok: false };
}
