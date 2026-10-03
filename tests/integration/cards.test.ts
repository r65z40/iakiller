import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  archiveCard, createCard, getCardForActor, listCardsForActor, publishCard, renameCardSlug, restoreVersion,
  saveDraft, setCardAssignees, setCardDisabled, unarchiveCard,
} from "@/lib/cards/service";
import { resolvePublicCard, resolvePublicToken } from "@/lib/cards/public";
import { DomainError } from "@/lib/errors";
import { addMember, createOrgWithOwner, resetDb } from "../helpers";

async function fillAndPublish(actor: Parameters<typeof createCard>[0], cardId: string, firstName = "Camille") {
  const card = await getCardForActor(actor, cardId);
  const doc = structuredClone(card.draft);
  doc.identity.firstName = firstName;
  doc.identity.lastName = "Martin";
  const saved = await saveDraft(actor, cardId, { revision: card.draftRevision, document: doc });
  expect(saved.ok).toBe(true);
  return publishCard(actor, cardId);
}

describe("quota d'essai", () => {
  beforeEach(resetDb);

  it("autorise trois cartes puis refuse la quatrième côté serveur", async () => {
    const { actor } = await createOrgWithOwner();
    for (let i = 0; i < 3; i++) await createCard(actor, { title: `Carte ${i}` });
    await expect(createCard(actor, { title: "Carte 4" })).rejects.toMatchObject({ code: "quota_exceeded" });
  });

  it("résiste aux créations simultanées", async () => {
    const { actor, org } = await createOrgWithOwner();
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => createCard(actor, { title: `Simultanée ${i}` })));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(3);
    const rows = await db.select().from(schema.card).where(eq(schema.card.organizationId, org.id));
    expect(rows).toHaveLength(3);
  });

  it("compte les brouillons, pas les cartes archivées, et bloque la désarchivation au-delà du quota", async () => {
    const { actor } = await createOrgWithOwner();
    const a = await createCard(actor, { title: "A" });
    await createCard(actor, { title: "B" });
    await createCard(actor, { title: "C" });
    await archiveCard(actor, a.id);
    const d = await createCard(actor, { title: "D" });
    expect(d.id).toBeTruthy();
    await expect(unarchiveCard(actor, a.id)).rejects.toMatchObject({ code: "quota_exceeded" });
  });
});

describe("brouillon et publication", () => {
  beforeEach(resetDb);

  it("un brouillon ne modifie pas la version publiée", async () => {
    const { actor, org } = await createOrgWithOwner();
    const c = await createCard(actor, { title: "Camille" });
    await fillAndPublish(actor, c.id, "Camille");
    const card = await getCardForActor(actor, c.id);
    const doc = structuredClone(card.draft);
    doc.identity.firstName = "Brouillon";
    await saveDraft(actor, c.id, { revision: card.draftRevision, document: doc });

    const [o] = await db.select().from(schema.organization).where(eq(schema.organization.id, org.id));
    const pub = await resolvePublicCard(o.slug, card.slug);
    expect(pub.kind).toBe("ok");
    if (pub.kind === "ok") expect(pub.document.identity.firstName).toBe("Camille");
  });

  it("détecte un conflit de révision", async () => {
    const { actor } = await createOrgWithOwner();
    const c = await createCard(actor, { title: "X" });
    const card = await getCardForActor(actor, c.id);
    const first = await saveDraft(actor, c.id, { revision: card.draftRevision, document: card.draft });
    expect(first.ok).toBe(true);
    const stale = await saveDraft(actor, c.id, { revision: card.draftRevision, document: card.draft });
    expect(stale).toMatchObject({ ok: false, conflict: true });
  });

  it("restaure une version antérieure dans le brouillon", async () => {
    const { actor } = await createOrgWithOwner();
    const c = await createCard(actor, { title: "V" });
    const v1 = await fillAndPublish(actor, c.id, "Première");
    let card = await getCardForActor(actor, c.id);
    const doc = structuredClone(card.draft);
    doc.identity.firstName = "Seconde";
    await saveDraft(actor, c.id, { revision: card.draftRevision, document: doc });
    await restoreVersion(actor, c.id, v1.versionId);
    card = await getCardForActor(actor, c.id);
    expect(card.draft.identity.firstName).toBe("Première");
  });

  it("refuse un document contenant une URL javascript:", async () => {
    const { actor } = await createOrgWithOwner();
    const c = await createCard(actor, { title: "Liens" });
    const card = await getCardForActor(actor, c.id);
    const doc = structuredClone(card.draft) as unknown as { blocks: { type: string; items?: unknown[] }[] };
    doc.blocks.push({ type: "links", id: "lienxss1", hidden: false, title: "", items: [{ id: "item0001", title: "x", subtitle: "", url: "javascript:alert(1)", icon: "link" }] } as never);
    await expect(saveDraft(actor, c.id, { revision: card.draftRevision, document: doc })).rejects.toBeInstanceOf(DomainError);
  });
});

describe("adresses et QR code", () => {
  beforeEach(resetDb);

  it("le QR reste valide après renommage et l'ancienne adresse redirige", async () => {
    const { actor, org } = await createOrgWithOwner();
    const c = await createCard(actor, { title: "Ancien nom" });
    await fillAndPublish(actor, c.id);
    const card = await getCardForActor(actor, c.id);
    const oldSlug = card.slug;
    const newSlug = await renameCardSlug(actor, c.id, "nouveau-nom");

    const qr = await resolvePublicToken(card.publicToken);
    expect(qr).toEqual({ kind: "redirect", path: `/${org.slug}/${newSlug}` });

    const old = await resolvePublicCard(org.slug, oldSlug);
    expect(old).toEqual({ kind: "redirect", path: `/${org.slug}/${newSlug}` });
  });

  it("la désactivation rend la carte et le QR indisponibles", async () => {
    const { actor, org } = await createOrgWithOwner();
    const c = await createCard(actor, { title: "Salarié" });
    await fillAndPublish(actor, c.id);
    const card = await getCardForActor(actor, c.id);
    await setCardDisabled(actor, c.id, true);
    expect((await resolvePublicCard(org.slug, card.slug)).kind).toBe("unavailable");
    expect((await resolvePublicToken(card.publicToken)).kind).toBe("unavailable");
  });

  it("l'essai expiré rend les cartes indisponibles sans aucune tâche planifiée", async () => {
    const past = new Date(Date.now() - 6 * 24 * 3600 * 1000);
    const { actor, org } = await createOrgWithOwner("Expirée", past);
    const c = await createCard(actor, { title: "Expire" });
    await fillAndPublish(actor, c.id);
    const card = await getCardForActor(actor, c.id);
    expect((await resolvePublicCard(org.slug, card.slug)).kind).toBe("ok");
    // On avance la fin d'essai dans le passé : la lecture publique doit refuser immédiatement.
    await db.update(schema.organization).set({ trialEndsAt: new Date(Date.now() - 1000) }).where(eq(schema.organization.id, org.id));
    expect((await resolvePublicCard(org.slug, card.slug)).kind).toBe("unavailable");
    expect((await resolvePublicToken(card.publicToken)).kind).toBe("unavailable");
    await expect(publishCard(actor, c.id)).rejects.toMatchObject({ code: "entitlement" });
  });
});

describe("isolation entre organisations et rôles", () => {
  beforeEach(resetDb);

  it("une organisation ne peut ni lire ni modifier la carte d'une autre", async () => {
    const a = await createOrgWithOwner("Entreprise A");
    const b = await createOrgWithOwner("Entreprise B");
    const cardA = await createCard(a.actor, { title: "Carte A" });
    const rowA = await getCardForActor(a.actor, cardA.id);

    await expect(getCardForActor(b.actor, cardA.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(saveDraft(b.actor, cardA.id, { revision: rowA.draftRevision, document: rowA.draft })).rejects.toMatchObject({ code: "not_found" });
    await expect(publishCard(b.actor, cardA.id)).rejects.toMatchObject({ code: "not_found" });
    // Un acteur qui prétend appartenir à A avec l'identifiant de A mais sans appartenance réelle
    // est un cas traité en amont (lib/context.ts) ; ici on vérifie que la liste de B est vide.
    expect(await listCardsForActor(b.actor)).toHaveLength(0);
  });

  it("un collaborateur ne voit et ne modifie que les cartes qui lui sont assignées", async () => {
    const { actor, org } = await createOrgWithOwner();
    const mine = await createCard(actor, { title: "Assignée" });
    const other = await createCard(actor, { title: "Autre" });
    const { actor: member, user } = await addMember(org.id, "member");
    await setCardAssignees(actor, mine.id, [user.id]);

    const list = await listCardsForActor(member);
    expect(list.map((c) => c.id)).toEqual([mine.id]);
    await expect(getCardForActor(member, other.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(createCard(member, { title: "Interdit" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(archiveCard(member, mine.id)).rejects.toMatchObject({ code: "forbidden" });

    // Révocation : retrait de l'appartenance, plus aucune assignation exploitable.
    await db.delete(schema.membership).where(eq(schema.membership.userId, user.id));
    await db.delete(schema.cardAssignment).where(eq(schema.cardAssignment.userId, user.id));
    await expect(getCardForActor(member, mine.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuse l'utilisation d'un média d'une autre organisation", async () => {
    const a = await createOrgWithOwner("Média A");
    const b = await createOrgWithOwner("Média B");
    await db.insert(schema.mediaAsset).values({ id: "mediaDeA00001", organizationId: a.org.id, kind: "image", mimeType: "image/webp", storageKey: "org/a/x.webp", originalName: "x.webp", sizeBytes: 10 });
    const c = await createCard(b.actor, { title: "B" });
    const row = await getCardForActor(b.actor, c.id);
    const doc = structuredClone(row.draft);
    doc.identity.photoMediaId = "mediaDeA00001";
    await expect(saveDraft(b.actor, c.id, { revision: row.draftRevision, document: doc })).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("essai unique par utilisateur", () => {
  beforeEach(resetDb);

  it("la deuxième organisation d'un même utilisateur démarre sans essai, même en parallèle", async () => {
    const { createOrganization } = await import("@/lib/orgs/service");
    const { loadEntitlement } = await import("@/lib/billing/load");
    const { createUser } = await import("../helpers");
    const u = await createUser();
    const results = await Promise.all([createOrganization(u, { name: "Première Org" }), createOrganization(u, { name: "Seconde Org" })]);
    expect(results.filter((r) => r.trial)).toHaveLength(1);
    const third = await createOrganization(u, { name: "Troisième Org" });
    expect(third.trial).toBe(false);
    const ent = await loadEntitlement(third.id);
    expect(ent.publicAccess).toBe(false);
    expect(ent.canEdit).toBe(true);
  });
});
