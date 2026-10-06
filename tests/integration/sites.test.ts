import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createSite, getSiteForActor, listSitesForActor, publishSite, saveSiteDraft } from "@/lib/sites/service";
import { recordSiteView, siteViewTotals } from "@/lib/sites/views";
import { createCard, getCardForActor, saveDraft } from "@/lib/cards/service";
import { newBlock } from "@/lib/cards/defaults";
import { parseSiteDocument } from "@/lib/sites/document";
import { resolvePublicSite } from "@/lib/sites/public";
import { submitSiteLead } from "@/lib/sites/leads";
import { listLeads } from "@/lib/leads/service";
import { leadFormToken } from "@/lib/security/signed";
import { resetRateLimits } from "@/lib/security/rate-limit";
import { createOrgWithOwner, resetDb } from "../helpers";

async function row(siteId: string) {
  const [s] = await db.select().from(schema.site).where(eq(schema.site.id, siteId));
  return s;
}

/** Crée un mini-site vierge, renseigne une société, puis le publie. */
async function publishedSite(actor: Parameters<typeof createSite>[0]) {
  const { id } = await createSite(actor, { title: "Mon site", template: "vierge" });
  const s = await getSiteForActor(actor, id);
  const parsed = parseSiteDocument(s.draft);
  if (!parsed.success) throw new Error("draft invalide");
  const doc = parsed.data;
  doc.identity.company = "Plomberie Durand";
  const saved = await saveSiteDraft(actor, id, { revision: s.draftRevision, document: doc });
  expect(saved.ok).toBe(true);
  await publishSite(actor, id);
  return row(id);
}

describe("mini-sites", () => {
  beforeEach(async () => {
    await resetDb();
    resetRateLimits();
  });

  it("crée un mini-site en brouillon, listé dans l'organisation", async () => {
    const { actor } = await createOrgWithOwner();
    const { id } = await createSite(actor, { title: "Vitrine", template: "artisan" });
    const s = await getSiteForActor(actor, id);
    expect(s.status).toBe("draft");
    expect(await listSitesForActor(actor)).toHaveLength(1);
  });

  it("détecte les conflits d'enregistrement via la révision", async () => {
    const { actor } = await createOrgWithOwner();
    const { id } = await createSite(actor, { title: "Vitrine" });
    const s = await getSiteForActor(actor, id);
    const first = await saveSiteDraft(actor, id, { revision: s.draftRevision, document: s.draft });
    expect(first.ok).toBe(true);
    const stale = await saveSiteDraft(actor, id, { revision: s.draftRevision, document: s.draft });
    expect(stale).toMatchObject({ ok: false, conflict: true });
  });

  it("refuse de publier sans nom ni société", async () => {
    const { actor } = await createOrgWithOwner();
    const { id } = await createSite(actor, { title: "Vitrine", template: "vierge" });
    await expect(publishSite(actor, id)).rejects.toMatchObject({ code: "invalid" });
  });

  it("publie, devient accessible publiquement, isole les autres organisations", async () => {
    const a = await createOrgWithOwner("Org A");
    const b = await createOrgWithOwner("Org B");
    const s = await publishedSite(a.actor);
    expect(s.status).toBe("published");
    expect(s.publishedVersionId).toBeTruthy();
    const pub = await resolvePublicSite(a.org.slug, s.slug);
    expect(pub.kind).toBe("ok");
    // Un autre client ne voit pas ce mini-site.
    expect(await listSitesForActor(b.actor)).toHaveLength(0);
  });

  it("une demande depuis un mini-site publié alimente le CRM (sans carte)", async () => {
    const { actor, org } = await createOrgWithOwner();
    const s = await publishedSite(actor);
    const formToken = leadFormToken(s.id, Date.now() - 5000);
    const r = await submitSiteLead({ token: s.publicToken, formToken, email: "client@exemple.test", message: "Bonjour, un devis ?" }, { ipKey: "ip-site" });
    expect(r.ok).toBe(true);
    const leads = await listLeads(actor);
    expect(leads).toHaveLength(1);
    expect(leads[0].lead.cardId).toBeNull();
    expect(leads[0].lead.source).toBe("direct");
    expect(leads[0].lead.sourceDetail).toContain("Mini-site");
    expect(org.id).toBe(leads[0].lead.organizationId);
  });

  it("refuse une demande de mini-site envoyée trop vite (anti-robot)", async () => {
    const { actor } = await createOrgWithOwner();
    const s = await publishedSite(actor);
    const freshToken = leadFormToken(s.id);
    const r = await submitSiteLead({ token: s.publicToken, formToken: freshToken, email: "client@exemple.test" }, { ipKey: "ip-fast" });
    expect(r).toMatchObject({ ok: false });
  });

  it("crée un mini-site à partir d'une carte (reprend identité et blocs)", async () => {
    const { actor } = await createOrgWithOwner();
    const card = await createCard(actor, { title: "Ma carte" });
    const row = await getCardForActor(actor, card.id);
    const doc = structuredClone(row.draft);
    doc.identity.company = "Atelier Durand";
    doc.blocks.push(newBlock("gallery"));
    await saveDraft(actor, card.id, { revision: row.draftRevision, document: doc });

    const { id } = await createSite(actor, { title: "", fromCardId: card.id });
    const s = await getSiteForActor(actor, id);
    expect(s.cardId).toBe(card.id);
    const parsed = parseSiteDocument(s.draft);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.identity.company).toBe("Atelier Durand");
      expect(parsed.data.pages.map((p) => p.key)).toEqual(["accueil", "contact"]);
      // Le formulaire est placé sur la page Contact, pas sur l'accueil.
      expect(parsed.data.pages[1].blocks.some((b) => b.type === "leadForm")).toBe(true);
    }
  });

  it("comptabilise les vues d'un mini-site par jour", async () => {
    const { actor } = await createOrgWithOwner();
    const s = await publishedSite(actor);
    await recordSiteView(s.id, s.organizationId);
    await recordSiteView(s.id, s.organizationId);
    const totals = await siteViewTotals(actor);
    const row = totals.find((t) => t.id === s.id);
    expect(row?.views).toBe(2);
  });
});
