import { describe, expect, it } from "vitest";
import { slugifyVariant, normalizeQrVariants, qrTargetUrl, activeQrDest, MAX_QR_VARIANTS, type QrVariant } from "@/lib/cards/qr";

describe("slugifyVariant", () => {
  it("normalise accents, espaces et casse", () => {
    expect(slugifyVariant("Véhicule")).toBe("vehicule");
    expect(slugifyVariant("Carte de visite")).toBe("carte-de-visite");
    expect(slugifyVariant("  Flyer  ")).toBe("flyer");
    expect(slugifyVariant("Vitrine #1")).toBe("vitrine-1");
  });
  it("retourne une chaîne vide pour un libellé sans caractère utile", () => {
    expect(slugifyVariant("   ")).toBe("");
    expect(slugifyVariant("!!!")).toBe("");
  });
  it("tronque à 32 caractères", () => {
    expect(slugifyVariant("a".repeat(50)).length).toBe(32);
  });
});

describe("normalizeQrVariants", () => {
  it("construit des variantes propres et dédoublonne les slugs (destination carte par défaut)", () => {
    const v = normalizeQrVariants([{ label: "Carte de visite" }, { label: "Véhicule" }, { label: "carte de visite" }]);
    expect(v).toEqual([
      { slug: "carte-de-visite", label: "Carte de visite", dest: { type: "card" } },
      { slug: "vehicule", label: "Véhicule", dest: { type: "card" } },
    ]);
  });
  it("valide les destinations (url http(s), section, sinon carte)", () => {
    const [url] = normalizeQrVariants([{ label: "Véhicule", dest: { type: "url", url: "https://exemple.fr/devis" } }]);
    expect(url.dest).toEqual({ type: "url", url: "https://exemple.fr/devis" });
    const [bad] = normalizeQrVariants([{ label: "X", dest: { type: "url", url: "pas-une-url" } }]);
    expect(bad.dest).toEqual({ type: "card" });
    const [sec] = normalizeQrVariants([{ label: "Y", dest: { type: "section", section: "blk_contacts" } }]);
    expect(sec.dest).toEqual({ type: "section", section: "blk_contacts" });
  });
  it("retient une campagne seulement si elle redirige ailleurs que la carte", () => {
    const [v] = normalizeQrVariants([{ label: "Promo", dest: { type: "card" }, campaign: { dest: { type: "url", url: "https://promo.fr" }, startsAt: "2026-01-01T00:00", endsAt: "2026-01-31T23:59" } }]);
    expect(v.campaign?.dest.type).toBe("url");
    expect(v.campaign?.dest.url).toContain("promo.fr");
    const [w] = normalizeQrVariants([{ label: "Rien", dest: { type: "card" }, campaign: { dest: { type: "card" } } }]);
    expect(w.campaign).toBeUndefined();
  });
  it("ignore les entrées invalides", () => {
    expect(normalizeQrVariants([{ label: "" }, { label: "   " }, { label: "###" }, null, 42, "x"])).toEqual([]);
    expect(normalizeQrVariants("pas un tableau")).toEqual([]);
  });
  it("borne le nombre de variantes", () => {
    const many = Array.from({ length: MAX_QR_VARIANTS + 5 }, (_, i) => ({ label: `Origine ${i}` }));
    expect(normalizeQrVariants(many).length).toBe(MAX_QR_VARIANTS);
  });
  it("tronque les libellés trop longs", () => {
    const [only] = normalizeQrVariants([{ label: "x".repeat(80) }]);
    expect(only.label.length).toBe(40);
  });
});

describe("activeQrDest (campagne temporaire)", () => {
  const base: QrVariant = {
    slug: "promo", label: "Promo", dest: { type: "card" },
    campaign: { dest: { type: "url", url: "https://promo.fr" }, startsAt: "2026-02-01T00:00:00Z", endsAt: "2026-02-10T00:00:00Z" },
  };
  it("utilise la campagne pendant la fenêtre", () => {
    expect(activeQrDest(base, new Date("2026-02-05T12:00:00Z")).type).toBe("url");
  });
  it("revient à la destination normale avant et après la fenêtre", () => {
    expect(activeQrDest(base, new Date("2026-01-20T12:00:00Z")).type).toBe("card");
    expect(activeQrDest(base, new Date("2026-02-20T12:00:00Z")).type).toBe("card");
  });
  it("sans campagne, renvoie la destination normale", () => {
    expect(activeQrDest({ slug: "s", label: "S", dest: { type: "section", section: "blk_form" } }).type).toBe("section");
  });
});

describe("qrTargetUrl", () => {
  it("renvoie le lien stable sans variante", () => {
    expect(qrTargetUrl("ABC123TOKEN")).toMatch(/\/r\/ABC123TOKEN$/);
  });
  it("ajoute le paramètre d'origine ?c= avec une variante", () => {
    expect(qrTargetUrl("ABC123TOKEN", "vehicule")).toMatch(/\/r\/ABC123TOKEN\?c=vehicule$/);
  });
});
