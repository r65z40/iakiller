import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { acceptInvitation, inviteMember, removeMember } from "@/lib/orgs/members";
import { createCard, getCardForActor, publishCard, saveDraft, setCardAssignees } from "@/lib/cards/service";
import { addLeadTask, csvCell, deleteLeadTask, exportLeadsCsv, listLeadActivity, listLeadTasks, listLeads, setLeadTaskDone, submitLead, toCsv, updateLead } from "@/lib/leads/service";
import { recordEvent } from "@/lib/analytics/service";
import { totals } from "@/lib/analytics/queries";
import { resolvePublicCard } from "@/lib/cards/public";
import { leadFormToken } from "@/lib/security/signed";
import { resetRateLimits } from "@/lib/security/rate-limit";
import { newBlock } from "@/lib/cards/defaults";
import { addMember, createOrgWithOwner, createUser, resetDb } from "../helpers";

async function publishedCardWithForm(actor: Parameters<typeof createCard>[0]) {
  const c = await createCard(actor, { title: "Formulaire" });
  const row = await getCardForActor(actor, c.id);
  const doc = structuredClone(row.draft);
  doc.identity.firstName = "Lina";
  doc.blocks.push(newBlock("leadForm"));
  await saveDraft(actor, c.id, { revision: row.draftRevision, document: doc });
  await publishCard(actor, c.id);
  return getCardForActor(actor, c.id);
}

function lastInvitationToken(text: string) {
  return text.match(/\/invitation\/([A-Za-z0-9_-]+)/)![1];
}

describe("invitations et membres", () => {
  beforeEach(resetDb);

  it("l'invitation n'est acceptable que par l'adresse invitée, une seule fois", async () => {
    const { actor, org } = await createOrgWithOwner();
    await inviteMember(actor, "alex@exemple.test", "member", "Propriétaire");
    const [mail] = await db.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, "alex@exemple.test"));
    const token = lastInvitationToken(mail.text);
    const intruder = await createUser("intrus@exemple.test");
    await expect(acceptInvitation(intruder, token)).rejects.toMatchObject({ code: "forbidden" });
    const alex = await createUser("alex@exemple.test");
    await acceptInvitation(alex, token);
    const ms = await db.select().from(schema.membership).where(eq(schema.membership.organizationId, org.id));
    expect(ms).toHaveLength(2);
    await expect(acceptInvitation(alex, token)).rejects.toMatchObject({ code: "invalid" });
  });

  it("une invitation expirée est refusée et le jeton brut n'est pas stocké", async () => {
    const { actor } = await createOrgWithOwner();
    await inviteMember(actor, "sam@exemple.test", "member", "P");
    const [mail] = await db.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, "sam@exemple.test"));
    const token = lastInvitationToken(mail.text);
    const [inv] = await db.select().from(schema.invitation);
    expect(inv.tokenHash).not.toContain(token);
    await db.update(schema.invitation).set({ expiresAt: new Date(Date.now() - 1000) });
    const sam = await createUser("sam@exemple.test");
    await expect(acceptInvitation(sam, token)).rejects.toMatchObject({ code: "invalid" });
  });

  it("un collaborateur ne peut pas inviter, un gestionnaire ne peut pas nommer de propriétaire", async () => {
    const { org } = await createOrgWithOwner();
    const { actor: member } = await addMember(org.id, "member");
    const { actor: manager } = await addMember(org.id, "manager");
    await expect(inviteMember(member, "x@exemple.test", "member", "m")).rejects.toMatchObject({ code: "forbidden" });
    await expect(inviteMember(manager, "x@exemple.test", "owner", "m")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("le quota de membres compte les invitations en attente", async () => {
    const { actor } = await createOrgWithOwner(); // essai : 3 membres
    await inviteMember(actor, "a@exemple.test", "member", "p");
    await inviteMember(actor, "b@exemple.test", "member", "p");
    await expect(inviteMember(actor, "c@exemple.test", "member", "p")).rejects.toMatchObject({ code: "quota_exceeded" });
  });

  it("retrait d'un salarié : accès révoqué, cartes désactivées sur demande", async () => {
    const { actor, org } = await createOrgWithOwner();
    const card = await publishedCardWithForm(actor);
    const { actor: member, user } = await addMember(org.id, "member");
    await setCardAssignees(actor, card.id, [user.id]);
    const [m] = await db.select().from(schema.membership).where(eq(schema.membership.userId, user.id));
    await removeMember(actor, m.id, { disableAssignedCards: true });
    await expect(getCardForActor(member, card.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await resolvePublicCard(org.slug, card.slug)).kind).toBe("unavailable");
  });
});

describe("prospects", () => {
  beforeEach(async () => {
    await resetDb();
    resetRateLimits();
  });

  const tokenAgo = (cardId: string, ms = 5000) => leadFormToken(cardId, Date.now() - ms);

  it("enregistre une demande valide, uniquement visible par l'organisation", async () => {
    const a = await createOrgWithOwner("Org A");
    const b = await createOrgWithOwner("Org B");
    const card = await publishedCardWithForm(a.actor);
    const r = await submitLead({ token: card.publicToken, formToken: tokenAgo(card.id), name: "Paul", email: "paul@exemple.test", message: "Bonjour" }, { ipKey: "ip1" });
    expect(r.ok).toBe(true);
    expect(await listLeads(a.actor)).toHaveLength(1);
    expect(await listLeads(b.actor)).toHaveLength(0);
  });

  it("champ piège : réponse positive mais rien n'est enregistré", async () => {
    const { actor } = await createOrgWithOwner();
    const card = await publishedCardWithForm(actor);
    const r = await submitLead({ token: card.publicToken, formToken: tokenAgo(card.id), email: "bot@exemple.test", website: "http://spam" }, { ipKey: "ip2" });
    expect(r.ok).toBe(true);
    expect(await db.select().from(schema.lead)).toHaveLength(0);
  });

  it("refuse un envoi trop rapide, sans contact, et déduplique", async () => {
    const { actor } = await createOrgWithOwner();
    const card = await publishedCardWithForm(actor);
    expect((await submitLead({ token: card.publicToken, formToken: leadFormToken(card.id), email: "x@exemple.test" }, { ipKey: "ip3" })).ok).toBe(false);
    expect((await submitLead({ token: card.publicToken, formToken: tokenAgo(card.id), name: "Sans contact" }, { ipKey: "ip3" })).ok).toBe(false);
    const ok = { token: card.publicToken, formToken: tokenAgo(card.id), email: "x@exemple.test", message: "même" };
    await submitLead(ok, { ipKey: "ip4" });
    await submitLead(ok, { ipKey: "ip4" });
    expect(await db.select().from(schema.lead)).toHaveLength(1);
  });

  it("limite la fréquence par connexion", async () => {
    const { actor } = await createOrgWithOwner();
    const card = await publishedCardWithForm(actor);
    const results = [];
    for (let i = 0; i < 7; i++) results.push(await submitLead({ token: card.publicToken, formToken: tokenAgo(card.id), email: `p${i}@exemple.test` }, { ipKey: "ip-flood" }));
    expect(results.filter((r) => !r.ok && r.status === 429).length).toBeGreaterThan(0);
  });

  it("neutralise les formules dans l'export CSV", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+33 6")).toBe("\"'+33 6\"");
    expect(csvCell("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
    expect(toCsv(["a"], [["-1"]])).toContain("\"'-1\"");
  });
});

describe("CRM — pipeline, source, tags, responsable, tâches", () => {
  beforeEach(async () => {
    await resetDb();
    resetRateLimits();
  });

  const tokenAgo = (cardId: string, ms = 5000) => leadFormToken(cardId, Date.now() - ms);

  async function oneLead(actor: Parameters<typeof createCard>[0], extra: Record<string, unknown> = {}) {
    const card = await publishedCardWithForm(actor);
    await submitLead(
      { token: card.publicToken, formToken: tokenAgo(card.id), name: "Paul", email: "paul@exemple.test", message: "Bonjour", ...extra },
      { ipKey: `ip-${Math.random()}` },
    );
    const [{ lead }] = await listLeads(actor);
    return lead;
  }

  it("capture la source QR et sa précision, étape initiale « nouveau »", async () => {
    const { actor } = await createOrgWithOwner();
    const lead = await oneLead(actor, { source: "qr", utmCampaign: "vitrine" });
    expect(lead.source).toBe("qr");
    expect(lead.sourceDetail).toBe("vitrine");
    expect(lead.stage).toBe("nouveau");
    const acts = await listLeadActivity(actor, lead.id);
    expect(acts.some((a) => a.activity.kind === "created")).toBe(true);
  });

  it("ramène une source inconnue à « direct »", async () => {
    const { actor } = await createOrgWithOwner();
    const lead = await oneLead(actor, { source: "pirate" });
    expect(lead.source).toBe("direct");
  });

  it("déplace l'étape, trace l'historique et refuse une étape invalide", async () => {
    const { actor } = await createOrgWithOwner();
    const lead = await oneLead(actor);
    await updateLead(actor, lead.id, { stage: "devis_envoye" });
    const [{ lead: after }] = await listLeads(actor);
    expect(after.stage).toBe("devis_envoye");
    const acts = await listLeadActivity(actor, lead.id);
    expect(acts.some((a) => a.activity.kind === "stage")).toBe(true);
    await expect(updateLead(actor, lead.id, { stage: "n_importe_quoi" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("filtre par étape", async () => {
    const { actor } = await createOrgWithOwner();
    const lead = await oneLead(actor);
    await updateLead(actor, lead.id, { stage: "gagne" });
    expect(await listLeads(actor, { stage: "gagne" })).toHaveLength(1);
    expect(await listLeads(actor, { stage: "nouveau" })).toHaveLength(0);
  });

  it("nettoie et déduplique les étiquettes", async () => {
    const { actor } = await createOrgWithOwner();
    const lead = await oneLead(actor);
    await updateLead(actor, lead.id, { tags: ["  VIP ", "vip", "urgent", "VIP"] });
    const [{ lead: after }] = await listLeads(actor);
    expect(after.tags).toEqual(["VIP", "vip", "urgent"]);
  });

  it("n'accepte comme responsable qu'un membre de l'organisation", async () => {
    const a = await createOrgWithOwner("Org A");
    const b = await createOrgWithOwner("Org B");
    const lead = await oneLead(a.actor);
    await expect(updateLead(a.actor, lead.id, { assignedToId: b.actor.user.id })).rejects.toMatchObject({ code: "invalid" });
    await updateLead(a.actor, lead.id, { assignedToId: a.actor.user.id });
    const [row] = await listLeads(a.actor);
    expect(row.lead.assignedToId).toBe(a.actor.user.id);
    expect(row.assigneeName).toBeTruthy();
  });

  it("gère les tâches : ajout, fait, suppression, scopées à l'organisation", async () => {
    const a = await createOrgWithOwner("Org A");
    const b = await createOrgWithOwner("Org B");
    const lead = await oneLead(a.actor);
    const taskId = await addLeadTask(a.actor, lead.id, { title: "Rappeler Paul" });
    expect(await listLeadTasks(a.actor, lead.id)).toHaveLength(1);
    await expect(listLeadTasks(b.actor, lead.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(setLeadTaskDone(b.actor, taskId, true)).rejects.toMatchObject({ code: "not_found" });
    await setLeadTaskDone(a.actor, taskId, true);
    const [t] = await listLeadTasks(a.actor, lead.id);
    expect(t.doneAt).not.toBeNull();
    await deleteLeadTask(a.actor, taskId);
    expect(await listLeadTasks(a.actor, lead.id)).toHaveLength(0);
  });

  it("l'export CSV contient les colonnes CRM", async () => {
    const { actor } = await createOrgWithOwner();
    const lead = await oneLead(actor, { source: "qr", utmCampaign: "flyer" });
    await updateLead(actor, lead.id, { stage: "gagne", assignedToId: actor.user.id });
    const csv = await exportLeadsCsv(actor);
    expect(csv).toContain("Étape");
    expect(csv).toContain("Gagné");
    expect(csv).toContain("qr (flyer)");
  });
});

describe("statistiques", () => {
  beforeEach(async () => {
    await resetDb();
    resetRateLimits();
  });
  const viewId = (n: number) => n.toString(16).padStart(24, "0");
  const meta = (o: Partial<{ ua: string; internal: boolean }> = {}) => ({ userAgent: o.ua ?? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit Safari Mobile", country: "FR", ipKey: "k", isInternal: o.internal ?? false });

  it("rejette une action sans affichage préalable et les cartes non publiées", async () => {
    const { actor } = await createOrgWithOwner();
    const card = await publishedCardWithForm(actor);
    expect((await recordEvent({ token: card.publicToken, viewId: viewId(1), type: "click_email" }, meta())).reason).toBe("orphan");
    const draft = await createCard(actor, { title: "Brouillon" });
    const d = await getCardForActor(actor, draft.id);
    expect((await recordEvent({ token: d.publicToken, viewId: viewId(2), type: "view" }, meta())).reason).toBe("card");
  });

  it("calcule le taux de clic sur les ouvertures mesurées, hors robots et visites internes", async () => {
    const a = await createOrgWithOwner("Stats A");
    const b = await createOrgWithOwner("Stats B");
    const card = await publishedCardWithForm(a.actor);
    await recordEvent({ token: card.publicToken, viewId: viewId(10), type: "view", source: "qr" }, meta());
    await recordEvent({ token: card.publicToken, viewId: viewId(10), type: "click_call_mobile" }, meta());
    await recordEvent({ token: card.publicToken, viewId: viewId(10), type: "click_call_mobile" }, meta()); // doublon ignoré
    await recordEvent({ token: card.publicToken, viewId: viewId(11), type: "view" }, meta());
    await recordEvent({ token: card.publicToken, viewId: viewId(12), type: "view" }, meta({ ua: "Googlebot/2.1" }));
    await recordEvent({ token: card.publicToken, viewId: viewId(13), type: "view" }, meta({ internal: true }));
    const range = { from: new Date(Date.now() - 86400_000), to: new Date(Date.now() + 1000) };
    const t = await totals(a.actor, range);
    expect(t).toMatchObject({ views: 2, actionViews: 1, clickRate: 0.5 });
    const tb = await totals(b.actor, range);
    expect(tb.views).toBe(0);
    const raw = await db.select().from(schema.analyticsEvent);
    expect(raw.every((e) => !("ip" in e))).toBe(true);
  });
});
