import { describe, expect, it } from "vitest";
import { parseDocument, publicDocument, type CardBlock } from "@/lib/cards/document";
import { emptyDocument, newBlock } from "@/lib/cards/defaults";

function docWithForm(form: Partial<Extract<CardBlock, { type: "leadForm" }>> = {}) {
  const base = emptyDocument();
  const leadForm = { ...(newBlock("leadForm") as Extract<CardBlock, { type: "leadForm" }>), ...form };
  return { ...base, blocks: [...base.blocks, leadForm] };
}

describe("leadForm — champs sur mesure", () => {
  it("remplit les valeurs par défaut pour un ancien document sans les nouveaux champs", () => {
    const doc = docWithForm();
    const raw = JSON.parse(JSON.stringify(doc)) as { blocks: Record<string, unknown>[] };
    for (const b of raw.blocks) {
      if (b.type === "leadForm") { delete b.customFields; delete b.notifyEmails; delete b.includeContentInEmail; }
    }
    const parsed = parseDocument(raw);
    expect(parsed.success).toBe(true);
    const form = parsed.success ? parsed.data.blocks.find((b) => b.type === "leadForm") : undefined;
    expect(form?.type).toBe("leadForm");
    if (form?.type === "leadForm") {
      expect(form.customFields).toEqual([]);
      expect(form.notifyEmails).toEqual([]);
      expect(form.includeContentInEmail).toBe(false);
    }
  });

  it("accepte un champ personnalisé de type liste avec des choix", () => {
    const doc = docWithForm({ customFields: [{ id: "cf_rdv01", label: "Type", type: "select", required: true, options: ["Devis", "RDV"] }] });
    expect(parseDocument(doc).success).toBe(true);
  });

  it("refuse un formulaire sans aucun moyen de recontact", () => {
    const doc = docWithForm({ fields: { name: "optional", email: "off", phone: "off", company: "off", message: "optional" }, customFields: [] });
    expect(parseDocument(doc).success).toBe(false);
  });

  it("autorise le recontact via un champ personnalisé email seul", () => {
    const doc = docWithForm({
      fields: { name: "optional", email: "off", phone: "off", company: "off", message: "optional" },
      customFields: [{ id: "cf_mail01", label: "Votre email", type: "email", required: true, options: [] }],
    });
    expect(parseDocument(doc).success).toBe(true);
  });

  it("ne laisse jamais fuiter les réglages de notification dans la projection publique", () => {
    const doc = docWithForm({ notifyEmails: ["secret@interne.fr"], includeContentInEmail: true });
    const pub = publicDocument(doc);
    const form = pub.blocks.find((b) => b.type === "leadForm");
    if (form?.type === "leadForm") {
      expect(form.notifyEmails).toEqual([]);
      expect(form.includeContentInEmail).toBe(false);
    }
  });
});
