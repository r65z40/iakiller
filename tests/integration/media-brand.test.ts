import { beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { processUpload, uploadMedia } from "@/lib/media/service";
import { updateBrand } from "@/lib/brand-service";
import { createCard, getCardForActor, saveDraft, setCardAssignees, publishCard } from "@/lib/cards/service";
import { resolvePublicCard } from "@/lib/cards/public";
import { qrPng, qrSvg } from "@/lib/cards/qr";
import { addMember, createOrgWithOwner, resetDb } from "../helpers";

describe("médias", () => {
  beforeEach(resetDb);

  it("refuse un faux type (HTML renommé en .jpg)", async () => {
    await expect(processUpload(Buffer.from("<html><script>alert(1)</script></html>"), "image")).rejects.toMatchObject({ code: "invalid" });
  });

  it("refuse le SVG, même valide", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(processUpload(svg, "image")).rejects.toMatchObject({ code: "invalid" });
  });

  it("refuse un PDF déguisé", async () => {
    await expect(processUpload(Buffer.from("%PDF-1.4 mais en fait du texte"), "document")).rejects.toBeTruthy();
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).png().toBuffer();
    await expect(processUpload(png, "document")).rejects.toMatchObject({ code: "invalid" });
  });

  it("refuse une image trop lourde", async () => {
    await expect(processUpload(Buffer.alloc(9 * 1024 * 1024, 1), "image")).rejects.toMatchObject({ code: "invalid" });
  });

  it("ré-encode les images et supprime les métadonnées EXIF", async () => {
    const withExif = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#0047bb" } })
      .withExif({ IFD0: { Copyright: "Secret", ImageDescription: "GPS 48.85,2.35" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await processUpload(withExif, "image");
    expect(out.mimeType).toBe("image/webp");
    const meta = await sharp(out.body).metadata();
    expect(meta.exif).toBeUndefined();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1600);
  });

  it("applique le quota de stockage", async () => {
    const { actor } = await createOrgWithOwner();
    const img = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#123456" } }).png().toBuffer();
    const { db, schema } = await import("@/lib/db");
    // Remplit artificiellement le quota d'essai (100 Mo).
    await db.insert(schema.mediaAsset).values({ id: "remplissage01", organizationId: actor.organization.id, kind: "document", mimeType: "application/pdf", storageKey: "org/x/fill.pdf", originalName: "fill.pdf", sizeBytes: 100 * 1024 * 1024 });
    await expect(uploadMedia(actor, { buffer: img, name: "a.png" }, "image")).rejects.toMatchObject({ code: "quota_exceeded" });
  });
});

describe("verrous de marque", () => {
  beforeEach(resetDb);

  it("un collaborateur ne peut pas contourner une couleur verrouillée par l'API", async () => {
    const { actor, org } = await createOrgWithOwner();
    await updateBrand(actor, { primaryColor: "#AA0000", backgroundColor: "#FFFFFF", textColor: "#111111", font: "inter", logoMediaId: null, companyName: "Marque SA", lockedFields: ["primaryColor", "company"] });
    const c = await createCard(actor, { title: "Salarié" });
    const { actor: member, user } = await addMember(org.id, "member");
    await setCardAssignees(actor, c.id, [user.id]);

    const row = await getCardForActor(member, c.id);
    const doc = structuredClone(row.draft);
    doc.theme.primaryColor = "#00FF00";
    doc.identity.company = "Ma boîte perso";
    doc.identity.firstName = "Alex";
    await saveDraft(member, c.id, { revision: row.draftRevision, document: doc });
    const saved = await getCardForActor(member, c.id);
    expect(saved.draft.theme.primaryColor).toBe("#AA0000");
    expect(saved.draft.identity.company).toBe("Marque SA");
    expect(saved.draft.identity.firstName).toBe("Alex");
  });

  it("un gestionnaire ne peut pas modifier les verrous", async () => {
    const { org } = await createOrgWithOwner();
    const { actor: manager } = await addMember(org.id, "manager");
    await expect(updateBrand(manager, { primaryColor: "#AA0000", backgroundColor: "#FFFFFF", textColor: "#111111", font: "inter", logoMediaId: null, companyName: "X", lockedFields: [] })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("un verrou ajouté après publication s'applique au rendu public", async () => {
    const { actor, org } = await createOrgWithOwner();
    const c = await createCard(actor, { title: "Publiée" });
    const row = await getCardForActor(actor, c.id);
    const doc = structuredClone(row.draft);
    doc.identity.firstName = "Lou";
    doc.theme.primaryColor = "#00AA00";
    await saveDraft(actor, c.id, { revision: row.draftRevision, document: doc });
    await publishCard(actor, c.id);
    await updateBrand(actor, { primaryColor: "#AA0000", backgroundColor: "#FFFFFF", textColor: "#111111", font: "inter", logoMediaId: null, companyName: "Y", lockedFields: ["primaryColor"] });
    const pub = await resolvePublicCard(org.slug, row.slug);
    expect(pub.kind === "ok" && pub.document.theme.primaryColor).toBe("#AA0000");
  });
});

describe("QR code", () => {
  it("le PNG généré se décode vers l'URL stable", async () => {
    const url = "https://exemple.fr/r/AbCdEfGhIjKlMnOpQrStUv";
    const png = PNG.sync.read(await qrPng(url, 600));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(url);
  });

  it("le SVG est autonome, sans script", async () => {
    const svg = await qrSvg("https://exemple.fr/r/abc");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/<script/i);
  });
});
