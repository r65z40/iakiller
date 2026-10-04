import { describe, expect, it } from "vitest";
import { buildSignatureHtml, SIGNATURE_TEMPLATES, signatureInputFromDocument, type SignatureInput } from "@/lib/signature/build";
import { emptyDocument } from "@/lib/cards/defaults";

const base: SignatureInput = {
  firstName: "Camille", lastName: "Moreau", jobTitle: "Menuisière", company: "Atelier Moreau",
  cardUrl: "https://ex.test/atelier/camille", photoUrl: "https://ex.test/m/photo",
  mobile: "06 39 98 12 34", email: "camille@atelier.test", website: "atelier.test",
  primaryColor: "#0047BB", textColor: "#14213D", mutedColor: "#5b6478", ctaLabel: "Voir ma carte",
};

describe("signature email", () => {
  it("construit une signature avec les coordonnées et le lien de la carte", () => {
    const html = buildSignatureHtml(base);
    expect(html).toContain("Camille Moreau");
    expect(html).toContain("Menuisière · Atelier Moreau");
    expect(html).toContain("tel:0639981234");
    expect(html).toContain("mailto:camille@atelier.test");
    expect(html).toContain('href="https://ex.test/atelier/camille"');
    expect(html).toContain("Voir ma carte");
  });

  it("échappe le contenu (anti-injection HTML)", () => {
    const html = buildSignatureHtml({ ...base, firstName: '<img src=x onerror=alert(1)>', lastName: "", company: "" });
    expect(html).not.toContain("<img src=x onerror");
    expect(html).toContain("&lt;img");
  });

  it("propose plusieurs styles distincts", () => {
    const html = SIGNATURE_TEMPLATES.map((t) => buildSignatureHtml(base, t.id));
    // Tous les styles produisent un HTML différent les uns des autres.
    expect(new Set(html).size).toBe(SIGNATURE_TEMPLATES.length);
    // La barre colorée utilise bien la couleur de marque, avec une colonne d'espacement.
    const banner = buildSignatureHtml(base, "banner");
    expect(banner).toContain("background:#0047BB");
    expect(banner).toContain("width:16px"); // espace entre la barre et le texte
    // L'encadré a une bordure.
    expect(buildSignatureHtml(base, "boxed")).toContain("border:1px solid");
  });

  it("options logo en bannière et mini QR", () => {
    const withBoth = buildSignatureHtml({ ...base, logoUrl: "https://ex.test/m/logo", qrUrl: "https://ex.test/r/tok/qr" }, "classic", { logoBanner: true, qr: true });
    expect(withBoth).toContain("https://ex.test/m/logo");
    expect(withBoth).toContain("https://ex.test/r/tok/qr");
  });

  it("extrait les champs d'une carte (bloc coordonnées, photo visible)", () => {
    const doc = emptyDocument();
    doc.identity.firstName = "Léa";
    doc.identity.showPhoto = true;
    doc.identity.photoMediaId = "media-photo";
    doc.blocks = [
      { id: "blk-contacts", type: "contacts", hidden: false, title: "Coordonnées", items: [
        { id: "it-mob", kind: "mobile", label: "Mobile", value: "06 00 00 00 00" },
        { id: "it-mail", kind: "email", label: "Email", value: "lea@ex.test" },
      ] },
    ] as typeof doc.blocks;
    const input = signatureInputFromDocument(doc, { cardUrl: "https://ex.test/o/lea", mediaUrl: (id) => `https://ex.test/m/${id}` });
    expect(input.mobile).toBe("06 00 00 00 00");
    expect(input.email).toBe("lea@ex.test");
    expect(input.photoUrl).toBe("https://ex.test/m/media-photo");
    expect(buildSignatureHtml(input)).toContain("Léa");
  });

  it("ignore une photo masquée", () => {
    const doc = emptyDocument();
    doc.identity.showPhoto = false;
    doc.identity.photoMediaId = "secret";
    const input = signatureInputFromDocument(doc, { cardUrl: "https://ex.test/o/x", mediaUrl: (id) => `https://ex.test/m/${id}` });
    expect(input.photoUrl).toBeUndefined();
  });
});
