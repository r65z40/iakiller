import { describe, expect, it } from "vitest";
import { STAGES, STAGE_IDS, STAGE_LABELS, sourceLabel } from "@/lib/leads/crm";

describe("constantes CRM", () => {
  it("expose le pipeline attendu dans l'ordre", () => {
    expect(STAGE_IDS).toEqual([
      "nouveau", "a_contacter", "contacte", "devis_a_preparer", "devis_envoye", "a_relancer", "gagne", "perdu",
    ]);
    expect(STAGE_LABELS.nouveau).toBe("Nouveau");
    expect(STAGE_LABELS.gagne).toBe("Gagné");
    expect(STAGES).toHaveLength(8);
  });

  it("libelle une source avec ou sans précision", () => {
    expect(sourceLabel("qr")).toBe("QR code");
    expect(sourceLabel("qr", "vitrine")).toBe("QR code · vitrine");
    expect(sourceLabel("campaign", "soldes")).toBe("Campagne · soldes");
    expect(sourceLabel("direct")).toBe("Lien direct");
    expect(sourceLabel("inconnue")).toBe("Lien direct");
  });
});
