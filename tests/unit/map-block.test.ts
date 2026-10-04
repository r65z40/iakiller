import { describe, expect, it } from "vitest";
import { parseDocument, publicDocument, type CardBlock } from "@/lib/cards/document";
import { emptyDocument, newBlock } from "@/lib/cards/defaults";

function docWithMap(map: Partial<Extract<CardBlock, { type: "map" }>> = {}) {
  const base = emptyDocument();
  const block = { ...(newBlock("map") as Extract<CardBlock, { type: "map" }>), ...map };
  return { ...base, blocks: [...base.blocks, block] };
}

describe("bloc map (zone d'intervention)", () => {
  it("applique les valeurs par défaut pour un document sans les nouveaux champs", () => {
    const doc = docWithMap();
    const raw = JSON.parse(JSON.stringify(doc)) as { blocks: Record<string, unknown>[] };
    for (const b of raw.blocks) if (b.type === "map") { delete b.zones; delete b.lat; delete b.lon; delete b.radiusKm; }
    const parsed = parseDocument(raw);
    expect(parsed.success).toBe(true);
    const m = parsed.success ? parsed.data.blocks.find((b) => b.type === "map") : undefined;
    if (m?.type === "map") {
      expect(m.zones).toEqual([]);
      expect(m.lat).toBeNull();
      expect(m.lon).toBeNull();
      expect(m.radiusKm).toBe(20);
    }
  });

  it("accepte des coordonnées valides et un rayon", () => {
    const doc = docWithMap({ address: "Lyon", lat: 45.75, lon: 4.85, radiusKm: 30, zones: ["Lyon", "Villeurbanne"] });
    expect(parseDocument(doc).success).toBe(true);
  });

  it("refuse des coordonnées hors bornes", () => {
    expect(parseDocument(docWithMap({ lat: 200, lon: 4.85 })).success).toBe(false);
  });

  it("refuse deux blocs carte", () => {
    const base = emptyDocument();
    const two = { ...base, blocks: [...base.blocks, newBlock("map"), newBlock("map")] };
    expect(parseDocument(two).success).toBe(false);
  });

  it("conserve le bloc carte dans la projection publique", () => {
    const doc = docWithMap({ lat: 45.75, lon: 4.85 });
    const pub = publicDocument(doc);
    expect(pub.blocks.some((b) => b.type === "map")).toBe(true);
  });
});
