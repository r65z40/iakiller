import { describe, expect, it } from "vitest";
import { slugifyVariant, normalizeQrVariants, qrTargetUrl, MAX_QR_VARIANTS } from "@/lib/cards/qr";

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
  it("construit des variantes propres et dédoublonne les slugs", () => {
    const v = normalizeQrVariants([{ label: "Carte de visite" }, { label: "Véhicule" }, { label: "carte de visite" }]);
    expect(v).toEqual([
      { slug: "carte-de-visite", label: "Carte de visite" },
      { slug: "vehicule", label: "Véhicule" },
    ]);
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

describe("qrTargetUrl", () => {
  it("renvoie le lien stable sans variante", () => {
    expect(qrTargetUrl("ABC123TOKEN")).toMatch(/\/r\/ABC123TOKEN$/);
  });
  it("ajoute le paramètre d'origine ?c= avec une variante", () => {
    expect(qrTargetUrl("ABC123TOKEN", "vehicule")).toMatch(/\/r\/ABC123TOKEN\?c=vehicule$/);
  });
});
