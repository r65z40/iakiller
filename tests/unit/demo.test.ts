import { describe, expect, it } from "vitest";
import { DEMO_CARDS } from "@/lib/cards/demo";
import { parseDocument, publishProblems } from "@/lib/cards/document";

describe("cartes de démonstration", () => {
  it("respectent le schéma et sont publiables", () => {
    for (const d of DEMO_CARDS) {
      const r = parseDocument(d.document);
      expect(r.success, d.id).toBe(true);
      if (r.success) expect(publishProblems(r.data)).toEqual([]);
    }
  });
});
