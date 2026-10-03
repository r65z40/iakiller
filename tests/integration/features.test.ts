import { beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { mapRows, parseCsv, runImport } from "@/lib/cards/import";
import { decodesTo, qrContrast, renderQrPng, setCardQrStyle, verifyQrStyle, cardQr } from "@/lib/cards/qr";
import { cropRect } from "@/lib/media/crop";
import { uploadMedia } from "@/lib/media/service";
import { createCard, getCardForActor, saveDraft } from "@/lib/cards/service";
import { acceptInvitation } from "@/lib/orgs/members";
import { emptyDocument, newBlock } from "@/lib/cards/defaults";
import { parseDocument, publishProblems } from "@/lib/cards/document";
import { createOrgWithOwner, createUser, resetDb } from "../helpers";

describe("import CSV", () => {
  beforeEach(resetDb);

  it("lit les exports Excel (point-virgule, guillemets, BOM, accents)", () => {
    const rows = parseCsv('﻿Prénom;Nom;Fonction;E-mail\r\n"Zoé";"Dupont; fils";"Cheffe ""d\'équipe""";zoe@exemple.fr\r\n');
    expect(rows[1]).toEqual(["Zoé", "Dupont; fils", 'Cheffe "d\'équipe"', "zoe@exemple.fr"]);
    const mapped = mapRows(rows);
    expect(mapped.rows[0].values).toMatchObject({ prenom: "Zoé", nom: "Dupont; fils", email: "zoe@exemple.fr" });
    expect(mapped.rows[0].errors).toEqual([]);
  });

  it("signale les lignes invalides et les doublons", () => {
    const mapped = mapRows(parseCsv("prenom,nom,email,mobile\nA,B,pas-un-email,06\nC,D,c@exemple.fr,06 39 98 12 34\nE,F,c@exemple.fr,\n,,,"));
    expect(mapped.rows.map((r) => r.errors.length > 0)).toEqual([true, false, true]);
  });

  it("refuse un fichier dépassant le quota, sans rien créer", async () => {
    const { actor, org } = await createOrgWithOwner();
    const csv = "prenom;nom\nA;Un\nB;Deux\nC;Trois\nD;Quatre";
    await expect(runImport(actor, csv, { template: "classique", invite: false, publish: false }, "P")).rejects.toMatchObject({ code: "quota_exceeded" });
    expect(await db.select().from(schema.card).where(eq(schema.card.organizationId, org.id))).toHaveLength(0);
  });

  it("crée les cartes, invite, et attribue la carte à l'acceptation", async () => {
    const { actor, org } = await createOrgWithOwner();
    const report = await runImport(actor, "prenom;nom;fonction;email;mobile\nLina;Martin;Technicienne;lina@exemple.test;06 39 98 12 34\n;;;;", { template: "entreprise", invite: true, publish: true }, "Patron");
    expect(report.created).toBe(1);
    expect(report.invited).toBe(1);
    expect(report.published).toBe(1);
    const [card] = await db.select().from(schema.card).where(eq(schema.card.organizationId, org.id));
    expect(card.draft.identity.firstName).toBe("Lina");
    expect(card.draft.theme.template).toBe("entreprise");
    const [mail] = await db.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, "lina@exemple.test"));
    const token = mail.text.match(/\/invitation\/([A-Za-z0-9_-]+)/)![1];
    const lina = await createUser("lina@exemple.test");
    await acceptInvitation(lina, token);
    const assigned = await db.select().from(schema.cardAssignment).where(eq(schema.cardAssignment.userId, lina.id));
    expect(assigned.map((a) => a.cardId)).toEqual([card.id]);
  });
});

describe("QR code personnalisé", () => {
  beforeEach(resetDb);
  const url = "https://cartes.exemple.fr/r/AbCdEfGhIjKlMnOpQrStUv";

  it("refuse une couleur trop claire", async () => {
    expect(qrContrast("#FFDD00")).toBeLessThan(4.5);
    expect((await verifyQrStyle(url, { dark: "#FFDD00", logo: "none" }, null)).ok).toBe(false);
  });

  it("une couleur foncée avec logo reste lisible et décodable", async () => {
    const logo = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#0047BB" } }).png().toBuffer();
    expect((await verifyQrStyle(url, { dark: "#0F5132", logo: "card" }, logo)).ok).toBe(true);
    expect(decodesTo(await renderQrPng(url, { dark: "#0F5132", logo: "card" }, logo, 600), url)).toBe(true);
  });

  it("enregistre un style vérifié avec le logo de la carte, et l'export reste lisible", async () => {
    const { actor } = await createOrgWithOwner();
    const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#8A4B1F" } }).png().toBuffer();
    const logo = await uploadMedia(actor, { buffer: png, name: "logo.png" }, "image");
    const c = await createCard(actor, { title: "QR" });
    const row = await getCardForActor(actor, c.id);
    const doc = structuredClone(row.draft);
    doc.identity.logoMediaId = logo.id;
    await saveDraft(actor, c.id, { revision: row.draftRevision, document: doc });
    await expect(setCardQrStyle(actor, c.id, { dark: "#EEEEEE", logo: "none" })).rejects.toMatchObject({ code: "invalid" });
    await setCardQrStyle(actor, c.id, { dark: "#14213D", logo: "card" });
    const card = await getCardForActor(actor, c.id);
    expect(card.qrStyle).toEqual({ dark: "#14213D", logo: "card" });
    const out = (await cardQr(card, "png")) as Buffer;
    expect(decodesTo(await sharp(out).resize(600).png().toBuffer(), `http://localhost:3000/r/${card.publicToken}`)).toBe(true);
  });
});

describe("recadrage", () => {
  it("calcule un cadre au bon format, borné dans l'image", () => {
    expect(cropRect(1000, 500, { aspect: 1, zoom: 1, x: 0.5, y: 0.5 })).toEqual({ left: 250, top: 0, width: 500, height: 500 });
    const r = cropRect(1000, 500, { aspect: 1, zoom: 2, x: 1, y: 1 });
    expect(r).toEqual({ left: 750, top: 250, width: 250, height: 250 });
    const wide = cropRect(400, 800, { aspect: 2.85, zoom: 1, x: 0, y: 0.5 });
    expect(wide.width).toBe(400);
    expect(Math.abs(wide.width / wide.height - 2.85)).toBeLessThan(0.02);
  });
});

describe("bloc avis clients", () => {
  it("n'accepte que des liens sûrs et exige au moins un lien pour publier", () => {
    const b = newBlock("reviews");
    const doc = emptyDocument();
    doc.identity.firstName = "A";
    doc.blocks.push(b);
    const ok = parseDocument(doc);
    expect(ok.success).toBe(true);
    if (ok.success) expect(publishProblems(ok.data).join(" ")).toMatch(/avis/);
    if (b.type === "reviews") b.readUrl = "javascript:alert(1)";
    expect(parseDocument(doc).success).toBe(false);
  });
});
