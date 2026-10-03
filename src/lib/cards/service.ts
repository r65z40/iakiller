import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { newId, newToken } from "@/lib/ids";
import { can, type MemberContext } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { loadEntitlement } from "@/lib/billing/load";
import { applyBrandLocks } from "@/lib/brand";
import { collectMediaIds, parseDocument, publishProblems, type CardDocument, type TemplateId } from "./document";
import { emptyDocument } from "./defaults";
import { slugify, validateCardSlug } from "./slug";

/** Acteur d'une opération. OrgContext (lib/context.ts) satisfait cette interface. */
export interface Actor extends MemberContext {
  user: { id: string };
  organization: { id: string };
  supportGrantId: string | null;
}

function actorAudit(actor: Actor) {
  return {
    organizationId: actor.organization.id,
    actorUserId: actor.user.id,
    actorType: actor.supportGrantId ? ("staff" as const) : ("user" as const),
    supportGrantId: actor.supportGrantId,
  };
}

/** Verrou de ligne sur l'organisation : sérialise les opérations soumises à quota. */
async function lockOrganization(tx: Tx, organizationId: string) {
  await tx.execute(sql`select id from ${schema.organization} where id = ${organizationId} for update`);
}

async function countActiveCards(tx: Tx, organizationId: string, excludeCardId?: string) {
  const conditions = [eq(schema.card.organizationId, organizationId), ne(schema.card.status, "archived")];
  if (excludeCardId) conditions.push(ne(schema.card.id, excludeCardId));
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.card)
    .where(and(...conditions));
  return row?.n ?? 0;
}

/**
 * Charge une carte en vérifiant qu'elle appartient à l'organisation de l'acteur ET que
 * l'acteur a le droit d'y accéder (gestion globale ou carte assignée).
 * Une carte d'une autre organisation renvoie "introuvable" (pas de fuite d'existence).
 */
export async function getCardForActor(actor: Actor, cardId: string, client: Tx | typeof db = db) {
  const [row] = await client
    .select()
    .from(schema.card)
    .where(and(eq(schema.card.id, cardId), eq(schema.card.organizationId, actor.organization.id)));
  if (!row) throw new DomainError("not_found", "Carte introuvable");
  if (can(actor, "cards.manageAll")) return row;
  const [assigned] = await client
    .select({ cardId: schema.cardAssignment.cardId })
    .from(schema.cardAssignment)
    .where(and(eq(schema.cardAssignment.cardId, cardId), eq(schema.cardAssignment.userId, actor.user.id)));
  if (!assigned) throw new DomainError("not_found", "Carte introuvable");
  return row;
}

export async function listCardsForActor(actor: Actor, opts: { includeArchived?: boolean } = {}) {
  const conditions = [eq(schema.card.organizationId, actor.organization.id)];
  if (!opts.includeArchived) conditions.push(ne(schema.card.status, "archived"));
  if (!can(actor, "cards.manageAll")) {
    const assigned = db
      .select({ id: schema.cardAssignment.cardId })
      .from(schema.cardAssignment)
      .where(eq(schema.cardAssignment.userId, actor.user.id));
    conditions.push(inArray(schema.card.id, assigned));
  }
  return db
    .select()
    .from(schema.card)
    .where(and(...conditions))
    .orderBy(desc(schema.card.updatedAt))
    .limit(500);
}

async function uniqueCardSlug(tx: Tx, organizationId: string, base: string) {
  const root = slugify(base) || "carte";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    if (validateCardSlug(candidate)) continue;
    const [exists] = await tx
      .select({ id: schema.card.id })
      .from(schema.card)
      .where(and(eq(schema.card.organizationId, organizationId), eq(schema.card.slug, candidate)));
    if (!exists) return candidate;
  }
  return `${root}-${newId(6).toLowerCase()}`;
}

async function loadBrand(tx: Tx | typeof db, organizationId: string) {
  const [b] = await tx.select().from(schema.brandSettings).where(eq(schema.brandSettings.organizationId, organizationId));
  return b ?? null;
}

/** Vérifie que chaque média référencé appartient à l'organisation (pas d'emprunt inter-entreprise). */
async function assertMediaOwnership(tx: Tx, organizationId: string, doc: CardDocument) {
  const ids = collectMediaIds(doc);
  if (ids.length === 0) return ids;
  const rows = await tx
    .select({ id: schema.mediaAsset.id, kind: schema.mediaAsset.kind })
    .from(schema.mediaAsset)
    .where(
      and(
        inArray(schema.mediaAsset.id, ids),
        eq(schema.mediaAsset.organizationId, organizationId),
        isNull(schema.mediaAsset.deletedAt),
      ),
    );
  if (rows.length !== ids.length) throw new DomainError("invalid", "Un média référencé est introuvable dans votre organisation.");
  return ids;
}

export async function createCard(
  actor: Actor,
  input: { title: string; template?: TemplateId; document?: CardDocument; assignToUserId?: string | null },
) {
  if (!can(actor, "cards.create")) throw new DomainError("forbidden", "Vous ne pouvez pas créer de carte.");
  const title = input.title.trim().slice(0, 80) || "Nouvelle carte";
  return db.transaction(async (tx) => {
    await lockOrganization(tx, actor.organization.id);
    const ent = await loadEntitlement(actor.organization.id, tx);
    if (!ent.canEdit) throw new DomainError("entitlement", "Votre organisation ne permet pas de créer de carte actuellement.");
    const count = await countActiveCards(tx, actor.organization.id);
    if (count >= ent.quotas.cards) {
      throw new DomainError("quota_exceeded", `Limite atteinte : ${ent.quotas.cards} carte(s) non archivée(s) pour votre formule.`);
    }
    const brand = await loadBrand(tx, actor.organization.id);
    let doc = input.document ?? emptyDocument(input.template ?? "classique");
    if (!input.document && brand) {
      doc.theme.primaryColor = brand.primaryColor;
      doc.theme.pageBackground = brand.backgroundColor;
      doc.theme.textColor = brand.textColor;
      doc.identity.logoMediaId = brand.logoMediaId;
      if (brand.companyName) doc.identity.company = brand.companyName;
    }
    doc = applyBrandLocks(doc, brand);
    const parsed = parseDocument(doc);
    if (!parsed.success) throw new DomainError("invalid", "Document de carte invalide.", parsed.error.issues);
    await assertMediaOwnership(tx, actor.organization.id, parsed.data);

    const id = newId();
    const slug = await uniqueCardSlug(tx, actor.organization.id, title);
    await tx.insert(schema.card).values({
      id,
      organizationId: actor.organization.id,
      slug,
      publicToken: newToken(),
      title,
      status: "draft",
      draft: parsed.data,
      createdById: actor.user.id,
    });
    if (input.assignToUserId) {
      const [m] = await tx
        .select({ id: schema.membership.id })
        .from(schema.membership)
        .where(and(eq(schema.membership.organizationId, actor.organization.id), eq(schema.membership.userId, input.assignToUserId)));
      if (!m) throw new DomainError("invalid", "Ce collaborateur n'appartient pas à l'organisation.");
      await tx.insert(schema.cardAssignment).values({ cardId: id, userId: input.assignToUserId, organizationId: actor.organization.id });
    }
    await audit({ ...actorAudit(actor), action: "card.create", targetType: "card", targetId: id }, tx);
    return { id, slug };
  });
}

export async function duplicateCard(actor: Actor, cardId: string) {
  const source = await getCardForActor(actor, cardId);
  const doc = structuredClone(source.draft);
  return createCard(actor, { title: `${source.title} (copie)`, document: doc });
}

export type SaveResult = { ok: true; revision: number; savedAt: string } | { ok: false; conflict: true; revision: number };

/**
 * Enregistre le brouillon. N'affecte JAMAIS la version publiée.
 * Contrôle de concurrence optimiste : la révision envoyée doit correspondre à la révision
 * en base, sinon un conflit est signalé (deux onglets ou deux personnes).
 */
export async function saveDraft(actor: Actor, cardId: string, input: { revision: number; document: unknown; title?: string }): Promise<SaveResult> {
  const parsed = parseDocument(input.document);
  if (!parsed.success) throw new DomainError("invalid", "Certaines valeurs sont invalides.", parsed.error.issues);
  return db.transaction(async (tx) => {
    const card = await getCardForActor(actor, cardId, tx);
    const ent = await loadEntitlement(actor.organization.id, tx);
    if (!ent.canEdit) throw new DomainError("entitlement", "La modification est suspendue pour cette organisation.");
    if (card.status === "archived") throw new DomainError("invalid", "Désarchivez la carte pour la modifier.");
    const brand = await loadBrand(tx, actor.organization.id);
    const doc = applyBrandLocks(parsed.data, brand);
    await assertMediaOwnership(tx, actor.organization.id, doc);
    const now = new Date();
    const title = input.title?.trim().slice(0, 80);
    const updated = await tx
      .update(schema.card)
      .set({
        draft: doc,
        draftRevision: sql`${schema.card.draftRevision} + 1`,
        draftUpdatedAt: now,
        updatedAt: now,
        ...(title ? { title } : {}),
      })
      .where(and(eq(schema.card.id, cardId), eq(schema.card.draftRevision, input.revision)))
      .returning({ revision: schema.card.draftRevision });
    if (updated.length === 0) {
      const [current] = await tx.select({ r: schema.card.draftRevision }).from(schema.card).where(eq(schema.card.id, cardId));
      return { ok: false as const, conflict: true as const, revision: current?.r ?? card.draftRevision };
    }
    return { ok: true as const, revision: updated[0].revision, savedAt: now.toISOString() };
  });
}

/** Publie le brouillon courant : crée un instantané immuable et le rend public. */
export async function publishCard(actor: Actor, cardId: string) {
  return db.transaction(async (tx) => {
    await lockOrganization(tx, actor.organization.id);
    const card = await getCardForActor(actor, cardId, tx);
    if (card.status === "archived") throw new DomainError("invalid", "Une carte archivée doit être désarchivée avant publication.");
    if (card.adminSuspendedAt) throw new DomainError("forbidden", "Cette carte est suspendue par la plateforme.");
    const ent = await loadEntitlement(actor.organization.id, tx);
    if (!ent.canPublish) throw new DomainError("entitlement", "Publication impossible : aucun essai ni abonnement actif.");
    const others = await countActiveCards(tx, actor.organization.id, cardId);
    if (others + 1 > ent.quotas.cards) {
      throw new DomainError("quota_exceeded", `Votre formule permet ${ent.quotas.cards} carte(s). Archivez une carte avant de publier.`);
    }
    const parsed = parseDocument(card.draft);
    if (!parsed.success) throw new DomainError("invalid", "Le brouillon contient des valeurs invalides.");
    const brand = await loadBrand(tx, actor.organization.id);
    const doc = applyBrandLocks(parsed.data, brand);
    const problems = publishProblems(doc);
    if (problems.length) throw new DomainError("invalid", problems.join(" "), problems);
    const mediaIds = await assertMediaOwnership(tx, actor.organization.id, doc);

    const [last] = await tx
      .select({ n: sql<number>`coalesce(max(${schema.cardVersion.number}), 0)::int` })
      .from(schema.cardVersion)
      .where(eq(schema.cardVersion.cardId, cardId));
    const versionId = newId();
    const number = (last?.n ?? 0) + 1;
    await tx.insert(schema.cardVersion).values({
      id: versionId,
      cardId,
      organizationId: actor.organization.id,
      number,
      document: doc,
      mediaIds,
      kind: "published",
      createdById: actor.user.id,
    });
    const now = new Date();
    await tx
      .update(schema.card)
      .set({ status: "published", publishedVersionId: versionId, publishedAt: now, updatedAt: now })
      .where(eq(schema.card.id, cardId));
    await audit({ ...actorAudit(actor), action: "card.publish", targetType: "card", targetId: cardId, metadata: { version: number } }, tx);
    return { versionId, number };
  });
}

/** Retire la carte de la publication sans perdre son contenu ni ses versions. */
export async function unpublishCard(actor: Actor, cardId: string) {
  const card = await getCardForActor(actor, cardId);
  if (card.status !== "published") return;
  await db.update(schema.card).set({ status: "draft", updatedAt: new Date() }).where(eq(schema.card.id, cardId));
  await audit({ ...actorAudit(actor), action: "card.unpublish", targetType: "card", targetId: cardId });
}

export async function archiveCard(actor: Actor, cardId: string) {
  if (!can(actor, "cards.manageAll")) throw new DomainError("forbidden", "Action réservée aux gestionnaires.");
  const card = await getCardForActor(actor, cardId);
  await db.update(schema.card).set({ status: "archived", updatedAt: new Date() }).where(eq(schema.card.id, card.id));
  await audit({ ...actorAudit(actor), action: "card.archive", targetType: "card", targetId: cardId });
}

/** Désarchivage : repasse en brouillon, sous réserve de quota (vérifié dans une transaction). */
export async function unarchiveCard(actor: Actor, cardId: string) {
  if (!can(actor, "cards.manageAll")) throw new DomainError("forbidden", "Action réservée aux gestionnaires.");
  await db.transaction(async (tx) => {
    await lockOrganization(tx, actor.organization.id);
    const card = await getCardForActor(actor, cardId, tx);
    if (card.status !== "archived") return;
    const ent = await loadEntitlement(actor.organization.id, tx);
    const count = await countActiveCards(tx, actor.organization.id);
    if (count >= ent.quotas.cards) throw new DomainError("quota_exceeded", `Limite de ${ent.quotas.cards} carte(s) atteinte.`);
    await tx.update(schema.card).set({ status: "draft", updatedAt: new Date() }).where(eq(schema.card.id, cardId));
    await audit({ ...actorAudit(actor), action: "card.unarchive", targetType: "card", targetId: cardId }, tx);
  });
}

/** Suppression définitive, possible uniquement pour une carte archivée. */
export async function deleteArchivedCard(actor: Actor, cardId: string) {
  if (!can(actor, "cards.manageAll")) throw new DomainError("forbidden", "Action réservée aux gestionnaires.");
  const card = await getCardForActor(actor, cardId);
  if (card.status !== "archived") throw new DomainError("invalid", "Archivez la carte avant de la supprimer.");
  await db.delete(schema.card).where(eq(schema.card.id, card.id));
  await audit({ ...actorAudit(actor), action: "card.delete", targetType: "card", targetId: cardId, metadata: { title: card.title } });
}

/** Désactivation (ex. salarié sortant) : la carte devient immédiatement indisponible. */
export async function setCardDisabled(actor: Actor, cardId: string, disabled: boolean) {
  if (!can(actor, "cards.manageAll")) throw new DomainError("forbidden", "Action réservée aux gestionnaires.");
  const card = await getCardForActor(actor, cardId);
  await db
    .update(schema.card)
    .set({ disabledAt: disabled ? new Date() : null, updatedAt: new Date() })
    .where(eq(schema.card.id, card.id));
  await audit({ ...actorAudit(actor), action: disabled ? "card.disable" : "card.enable", targetType: "card", targetId: cardId });
}

export async function restoreVersion(actor: Actor, cardId: string, versionId: string) {
  return db.transaction(async (tx) => {
    const card = await getCardForActor(actor, cardId, tx);
    const [version] = await tx
      .select()
      .from(schema.cardVersion)
      .where(and(eq(schema.cardVersion.id, versionId), eq(schema.cardVersion.cardId, card.id)));
    if (!version) throw new DomainError("not_found", "Version introuvable");
    const parsed = parseDocument(version.document);
    if (!parsed.success) throw new DomainError("invalid", "Cette version n'est plus compatible.");
    const [row] = await tx
      .update(schema.card)
      .set({ draft: parsed.data, draftRevision: sql`${schema.card.draftRevision} + 1`, draftUpdatedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.card.id, card.id))
      .returning({ revision: schema.card.draftRevision });
    await audit({ ...actorAudit(actor), action: "card.restore_version", targetType: "card", targetId: cardId, metadata: { version: version.number } }, tx);
    return { revision: row.revision };
  });
}

export async function listVersions(actor: Actor, cardId: string) {
  const card = await getCardForActor(actor, cardId);
  return db
    .select({ id: schema.cardVersion.id, number: schema.cardVersion.number, createdAt: schema.cardVersion.createdAt, kind: schema.cardVersion.kind })
    .from(schema.cardVersion)
    .where(eq(schema.cardVersion.cardId, card.id))
    .orderBy(desc(schema.cardVersion.number))
    .limit(50);
}

/**
 * Change l'adresse de la carte. L'ancienne adresse redirige vers la nouvelle ; elle reste
 * propre à l'organisation (une autre entreprise ne peut pas la détourner, car le périmètre
 * des slugs de carte est l'organisation elle-même).
 */
export async function renameCardSlug(actor: Actor, cardId: string, rawSlug: string) {
  if (!can(actor, "cards.manageAll")) throw new DomainError("forbidden", "Action réservée aux gestionnaires.");
  const slug = slugify(rawSlug);
  const problem = validateCardSlug(slug);
  if (problem) throw new DomainError("invalid", problem);
  await db.transaction(async (tx) => {
    const card = await getCardForActor(actor, cardId, tx);
    if (card.slug === slug) return;
    const [taken] = await tx
      .select({ id: schema.card.id })
      .from(schema.card)
      .where(and(eq(schema.card.organizationId, actor.organization.id), eq(schema.card.slug, slug)));
    if (taken) throw new DomainError("slug_taken", "Cette adresse est déjà utilisée par une autre carte.");
    // L'ancienne adresse d'une autre carte de la même organisation peut être réutilisée :
    // la redirection correspondante est alors supprimée.
    await tx
      .delete(schema.slugRedirect)
      .where(and(eq(schema.slugRedirect.kind, "card"), eq(schema.slugRedirect.organizationId, actor.organization.id), eq(schema.slugRedirect.oldSlug, slug)));
    await tx
      .insert(schema.slugRedirect)
      .values({ id: newId(), kind: "card", organizationId: actor.organization.id, cardId: card.id, oldSlug: card.slug })
      .onConflictDoNothing();
    await tx.update(schema.card).set({ slug, updatedAt: new Date() }).where(eq(schema.card.id, card.id));
    await audit({ ...actorAudit(actor), action: "card.rename_slug", targetType: "card", targetId: cardId, metadata: { from: card.slug, to: slug } }, tx);
  });
  return slug;
}

export async function setCardAssignees(actor: Actor, cardId: string, userIds: string[]) {
  if (!can(actor, "cards.assign")) throw new DomainError("forbidden", "Action réservée aux gestionnaires.");
  await db.transaction(async (tx) => {
    const card = await getCardForActor(actor, cardId, tx);
    const unique = [...new Set(userIds)].slice(0, 50);
    if (unique.length) {
      const members = await tx
        .select({ userId: schema.membership.userId })
        .from(schema.membership)
        .where(and(eq(schema.membership.organizationId, actor.organization.id), inArray(schema.membership.userId, unique)));
      if (members.length !== unique.length) throw new DomainError("invalid", "Un des collaborateurs n'appartient pas à l'organisation.");
    }
    await tx.delete(schema.cardAssignment).where(eq(schema.cardAssignment.cardId, card.id));
    if (unique.length) {
      await tx.insert(schema.cardAssignment).values(unique.map((userId) => ({ cardId: card.id, userId, organizationId: actor.organization.id })));
    }
    await audit({ ...actorAudit(actor), action: "card.assign", targetType: "card", targetId: cardId, metadata: { userIds: unique } }, tx);
  });
}
