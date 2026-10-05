import { describe, expect, it } from "vitest";
import { parseDocument, publicDocument, collectMediaIds, type CardBlock } from "@/lib/cards/document";
import { emptyDocument, newBlock } from "@/lib/cards/defaults";

function docWithBA(items: Extract<CardBlock, { type: "beforeAfter" }>["items"]) {
  const base = emptyDocument();
  const block = { ...(newBlock("beforeAfter") as Extract<CardBlock, { type: "beforeAfter" }>), items };
  return { ...base, blocks: [...base.blocks, block] };
}

describe("bloc beforeAfter (avant/après)", () => {
  it("se crée avec des valeurs par défaut valides", () => {
    expect(parseDocument(docWithBA([])).success).toBe(true);
  });

  it("accepte une comparaison complète et référence ses deux médias", () => {
    const doc = docWithBA([{ id: "cmp_01", beforeMediaId: "med_before01", afterMediaId: "med_after001", caption: "Salon", description: "Rénovation complète" }]);
    expect(parseDocument(doc).success).toBe(true);
    const ids = collectMediaIds(doc);
    expect(ids).toContain("med_before01");
    expect(ids).toContain("med_after001");
  });

  it("retire les comparaisons incomplètes de la projection publique", () => {
    const doc = docWithBA([
      { id: "cmp_full01", beforeMediaId: "med_before01", afterMediaId: "med_after001", caption: "", description: "" },
      { id: "cmp_half01", beforeMediaId: "med_before02", afterMediaId: "", caption: "", description: "" },
    ]);
    const pub = publicDocument(doc);
    const b = pub.blocks.find((x) => x.type === "beforeAfter");
    if (b?.type === "beforeAfter") expect(b.items.map((i) => i.id)).toEqual(["cmp_full01"]);
  });
});
