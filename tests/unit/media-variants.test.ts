import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { publicSrcSet } from "@/lib/media/variant-url";
import { imageVariant, parseVariantWidth } from "@/lib/media/variants";

describe("variantes d'images publiques", () => {
  it("ne propose de variantes que pour les médias publics, plus étroites que l'original", () => {
    expect(publicSrcSet("/api/media/abc", 1600)).toBeUndefined();
    expect(publicSrcSet(undefined)).toBeUndefined();
    expect(publicSrcSet("/m/abc", 700)).toBe("/m/abc?w=160 160w, /m/abc?w=320 320w, /m/abc?w=640 640w, /m/abc 700w");
    expect(publicSrcSet("/m/abc", 100)).toBeUndefined();
  });

  it("n'accepte que les largeurs prévues (pas de redimensionnement arbitraire)", () => {
    expect(parseVariantWidth("320")).toBe(320);
    expect(parseVariantWidth("321")).toBeNull();
    expect(parseVariantWidth(null)).toBeNull();
    expect(parseVariantWidth("99999")).toBeNull();
  });

  it("réduit l'image et réutilise la variante déjà calculée", async () => {
    const original = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#0047BB" } }).webp().toBuffer();
    let reads = 0;
    const load = async () => {
      reads++;
      return original;
    };
    const key = `test-${Date.now()}`;
    const v = await imageVariant(key, load, 320);
    expect((await sharp(v!).metadata()).width).toBe(320);
    await imageVariant(key, load, 320);
    expect(reads).toBe(1);
  });
});
