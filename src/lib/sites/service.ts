import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { newId, newToken } from "@/lib/ids";
import { can } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { loadEntitlement } from "@/lib/billing/load";
import { slugify, validateCardSlug } from "@/lib/cards/slug";
import { getCardForActor, type Actor } from "@/lib/cards/service";
import { parseDocument } from "@/lib/cards/document";
import { emptyDocument, newBlock } from "@/lib/cards/defaults";
import { blockId } from "@/lib/cards/client-ids";
import { CURRENT_SCHEMA_VERSION } from "@/lib/cards/constants";
import { collectSiteMediaIds, parseSiteDocument, siteProblems, type SiteDocument } from "./document";
import { buildSiteTemplate } from "./defaults";

/** Construit un mini-site à partir du contenu d'une carte (reprend thème, identité, bannière et blocs). */
function siteDocFromCard(cardDraft: unknown): SiteDocument {
  const parsed = parseDocument(cardDraft);
  const cd = parsed.success ? parsed.data : emptyDocument();
  const leadForm = cd.blocks.find((b) => b.type === "leadForm");
  const homeBlocks = cd.blocks.filter((b) => b.type !== "leadForm");
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    theme: cd.theme,
    identity: cd.identity,
    banner: cd.banner,
    pages: [
      { id: blockId(), key: "accueil", label: "Accueil", slug: "accueil", blocks: homeBlocks.length ? homeBlocks : [newBlock("about")] },
      { id: blockId(), key: "contact", label: "Contact", slug: "contact", blocks: [leadForm ?? newBlock("leadForm")] },
    ],
  };
}

export type SaveSiteResult = { ok: true; revision: number; savedAt: string } | { ok: false; conflict: true; revision: number };

function assertCanManage(actor: Actor) {
  if (!can(actor, "cards.create")) throw new DomainError("forbidden", "La gestion des mini-sites est réservée aux gestionnaires.");
}

async function lockOrganization(tx: Tx, organizationId: string) {
  await tx.execute(sql`select id from ${schema.organization} where id = ${organizationId} for update`);
}

async function countActiveSites(tx: Tx, organizationId: string, excludeSiteId?: string) {
  const conditions = [eq(schema.site.organizationId, organizationId), ne(schema.site.status, "archived")];
  if (excludeSiteId) conditions.push(ne(schema.site.id, excludeSiteId));
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.site).where(and(...conditions));
  return row?.n ?? 0;
}

async function uniqueSiteSlug(tx: Tx, organizationId: string, base: string) {
  const root = slugify(base) || "site";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    if (validateCardSlug(candidate)) continue;
    const [exists] = await tx
      .select({ id: schema.site.id })
      .from(schema.site)
      .where(and(eq(schema.site.organizationId, organizationId), eq(schema.site.slug, candidate)));
    if (!exists) return candidate;
  }
  return `${root}-${newId(6).toLowerCase()}`;
}

/** Vérifie que chaque média du site appartient à l'organisation (pas d'emprunt inter-entreprise). */
async function assertSiteMediaOwnership(tx: Tx | typeof db, organizationId: string, doc: SiteDocument) {
  const ids = collectSiteMediaIds(doc);
  if (ids.length === 0) return ids;
  const rows = await tx
    .select({ id: schema.mediaAsset.id })
    .from(schema.mediaAsset)
    .where(and(inArray(schema.mediaAsset.id, ids), eq(schema.mediaAsset.organizationId, organizationId), isNull(schema.mediaAsset.deletedAt)));
  if (rows.length !== ids.length) throw new DomainError("invalid", "Un média référencé est introuvable dans votre organisation.");
  return ids;
}

export async function getSiteForActor(actor: Actor, siteId: string, client: Tx | typeof db = db) {
  assertCanManage(actor);
  const [row] = await client.select().from(schema.site).where(and(eq(schema.site.id, siteId), eq(schema.site.organizationId, actor.organization.id)));
  if (!row) throw new DomainError("not_found", "Mini-site introuvable");
  return row;
}

export async function listSitesForActor(actor: Actor) {
  assertCanManage(actor);
  return db
    .select()
    .from(schema.site)
    .where(and(eq(schema.site.organizationId, actor.organization.id), ne(schema.site.status, "archived")))
    .orderBy(desc(schema.site.updatedAt))
    .limit(200);
}

export async function createSite(actor: Actor, input: { title: string; template?: string; fromCardId?: string | null }) {
  assertCanManage(actor);
  let title = input.title.trim().slice(0, 120) || "Mon mini-site";
  return db.transaction(async (tx) => {
    await lockOrganization(tx, actor.organization.id);
    const ent = await loadEntitlement(actor.organization.id, tx);
    if (!ent.marketingSuite) throw new DomainError("entitlement", "Les mini-sites sont inclus à partir de la formule Pro.");
    if (!ent.canEdit) throw new DomainError("entitlement", "Votre essai ou abonnement ne permet pas de créer un mini-site.");
    if ((await countActiveSites(tx, actor.organization.id)) >= ent.quotas.cards) {
      throw new DomainError("quota_exceeded", "Vous avez atteint le nombre de mini-sites de votre formule.");
    }

    // À partir d'une carte (reprise du contenu) ou d'un modèle métier.
    let cardId: string | null = null;
    let doc: SiteDocument;
    if (input.fromCardId) {
      const card = await getCardForActor(actor, input.fromCardId, tx);
      doc = siteDocFromCard(card.draft);
      cardId = card.id;
      if (!input.title.trim()) title = card.title;
    } else {
      doc = buildSiteTemplate(input.template ?? "vierge");
    }
    const parsed = parseSiteDocument(doc);
    if (!parsed.success) throw new DomainError("invalid", "Contenu de mini-site invalide.");
    await assertSiteMediaOwnership(tx, actor.organization.id, parsed.data);

    const id = newId();
    await tx.insert(schema.site).values({
      id,
      organizationId: actor.organization.id,
      slug: await uniqueSiteSlug(tx, actor.organization.id, title),
      publicToken: newToken(),
      status: "draft",
      title,
      draft: parsed.data,
      cardId,
      createdById: actor.user.id,
    });
    await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "site.create", targetId: id });
    return { id };
  });
}

export async function saveSiteDraft(actor: Actor, siteId: string, input: { revision: number; document: unknown; title?: string }): Promise<SaveSiteResult> {
  assertCanManage(actor);
  const parsed = parseSiteDocument(input.document);
  if (!parsed.success) throw new DomainError("invalid", "Le contenu du mini-site est invalide.");
  const site = await getSiteForActor(actor, siteId);
  if (site.status === "archived") throw new DomainError("invalid", "Ce mini-site est archivé.");
  const ent = await loadEntitlement(actor.organization.id);
  if (!ent.marketingSuite) throw new DomainError("entitlement", "Les mini-sites sont inclus à partir de la formule Pro.");
  if (!ent.canEdit) throw new DomainError("entitlement", "Votre essai ou abonnement ne permet plus de modifier ce mini-site.");
  await assertSiteMediaOwnership(db, actor.organization.id, parsed.data);

  const now = new Date();
  const set: Partial<typeof schema.site.$inferInsert> = { draft: parsed.data, draftUpdatedAt: now, updatedAt: now, draftRevision: input.revision + 1 };
  if (input.title !== undefined) set.title = input.title.trim().slice(0, 120) || site.title;
  const updated = await db
    .update(schema.site)
    .set(set)
    .where(and(eq(schema.site.id, siteId), eq(schema.site.draftRevision, input.revision)))
    .returning({ revision: schema.site.draftRevision });
  if (updated.length === 0) {
    const [current] = await db.select({ revision: schema.site.draftRevision }).from(schema.site).where(eq(schema.site.id, siteId));
    return { ok: false, conflict: true, revision: current?.revision ?? input.revision };
  }
  return { ok: true, revision: updated[0].revision, savedAt: now.toISOString() };
}

export async function publishSite(actor: Actor, siteId: string) {
  assertCanManage(actor);
  return db.transaction(async (tx) => {
    await lockOrganization(tx, actor.organization.id);
    const site = await getSiteForActor(actor, siteId, tx);
    if (site.status === "archived") throw new DomainError("invalid", "Ce mini-site est archivé.");
    if (site.adminSuspendedAt) throw new DomainError("forbidden", "Mini-site suspendu par la plateforme.");
    const ent = await loadEntitlement(actor.organization.id, tx);
    if (!ent.marketingSuite) throw new DomainError("entitlement", "Les mini-sites sont inclus à partir de la formule Pro.");
    if (!ent.canPublish) throw new DomainError("entitlement", "Publication impossible sans essai ni abonnement actif.");

    const parsed = parseSiteDocument(site.draft);
    if (!parsed.success) throw new DomainError("invalid", "Le contenu du mini-site est invalide.");
    const problems = siteProblems(parsed.data);
    if (problems.length > 0) throw new DomainError("invalid", problems[0]);
    const mediaIds = await assertSiteMediaOwnership(tx, actor.organization.id, parsed.data);

    const [last] = await tx.select({ number: schema.siteVersion.number }).from(schema.siteVersion).where(eq(schema.siteVersion.siteId, siteId)).orderBy(desc(schema.siteVersion.number)).limit(1);
    const number = (last?.number ?? 0) + 1;
    const versionId = newId();
    await tx.insert(schema.siteVersion).values({ id: versionId, siteId, organizationId: actor.organization.id, number, document: parsed.data, mediaIds, createdById: actor.user.id });
    await tx.update(schema.site).set({ status: "published", publishedVersionId: versionId, publishedAt: new Date(), updatedAt: new Date() }).where(eq(schema.site.id, siteId));
    await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "site.publish", targetId: siteId, metadata: { number } });
    return { versionId, number };
  });
}

export async function unpublishSite(actor: Actor, siteId: string) {
  assertCanManage(actor);
  const site = await getSiteForActor(actor, siteId);
  await db.update(schema.site).set({ status: "draft", publishedVersionId: null, publishedAt: null, updatedAt: new Date() }).where(eq(schema.site.id, siteId));
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "site.unpublish", targetId: site.id });
}

export async function deleteSite(actor: Actor, siteId: string) {
  assertCanManage(actor);
  const deleted = await db.delete(schema.site).where(and(eq(schema.site.id, siteId), eq(schema.site.organizationId, actor.organization.id))).returning({ id: schema.site.id });
  if (deleted.length === 0) throw new DomainError("not_found", "Mini-site introuvable");
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "site.delete", targetId: siteId });
}
