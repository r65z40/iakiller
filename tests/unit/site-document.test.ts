import { describe, expect, it } from "vitest";
import { collectSiteMediaIds, pageDocument, parseSiteDocument, publicSiteDocument, siteProblems } from "@/lib/sites/document";
import { buildSiteTemplate, emptySiteDocument, SITE_TEMPLATES } from "@/lib/sites/defaults";

describe("modèle de mini-site", () => {
  it("un site vierge est valide et possède quatre pages", () => {
    const doc = emptySiteDocument();
    const parsed = parseSiteDocument(doc);
    expect(parsed.success).toBe(true);
    expect(doc.pages.map((p) => p.key)).toEqual(["accueil", "services", "realisations", "contact"]);
  });

  it("tous les modèles métiers sont valides", () => {
    for (const t of SITE_TEMPLATES) {
      const parsed = parseSiteDocument(buildSiteTemplate(t.id));
      expect(parsed.success, `${t.id} invalide`).toBe(true);
    }
  });

  it("compose une page en CardDocument (thème/identité/bannière partagés)", () => {
    const doc = emptySiteDocument();
    const cd = pageDocument(doc, doc.pages[0]);
    expect(cd.theme).toBe(doc.theme);
    expect(cd.identity).toBe(doc.identity);
    expect(cd.blocks).toBe(doc.pages[0].blocks);
  });

  it("la projection publique retire les blocs masqués", () => {
    const doc = emptySiteDocument();
    doc.pages[0].blocks[0].hidden = true;
    const kept = doc.pages[0].blocks.length - 1;
    const pub = publicSiteDocument(doc);
    expect(pub.pages[0].blocks).toHaveLength(kept);
  });

  it("refuse deux pages de même adresse", () => {
    const doc = emptySiteDocument();
    doc.pages[1].slug = doc.pages[0].slug;
    expect(parseSiteDocument(doc).success).toBe(false);
  });

  it("exige au moins un nom ou une société pour publier", () => {
    const doc = emptySiteDocument();
    expect(siteProblems(doc).some((p) => p.toLowerCase().includes("nom"))).toBe(true);
    doc.identity.company = "Plomberie Durand";
    expect(siteProblems(doc)).toHaveLength(0);
  });

  it("collecte les médias de toutes les pages sans doublon", () => {
    const doc = emptySiteDocument();
    doc.identity.logoMediaId = "med_logo0001";
    doc.identity.showLogo = true;
    const g = doc.pages[0].blocks.find((b) => b.type === "gallery");
    if (g && g.type === "gallery") g.items = [{ id: "i1", mediaId: "med_photo001", caption: "" }];
    const ids = collectSiteMediaIds(doc);
    expect(ids).toContain("med_logo0001");
    expect(ids).toContain("med_photo001");
    expect(new Set(ids).size).toBe(ids.length);
  });
});
