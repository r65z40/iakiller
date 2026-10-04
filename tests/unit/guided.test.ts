import { describe, expect, it } from "vitest";
import { buildGuidedDocument, guidedTitle } from "@/lib/cards/guided";
import { parseDocument } from "@/lib/cards/document";

describe("création guidée", () => {
  it("construit un document valide avec les coordonnées valides", () => {
    const doc = buildGuidedDocument({
      firstName: "Camille", lastName: "Moreau", jobTitle: "Menuisière", company: "Atelier Moreau",
      mobile: "06 12 34 56 78", email: "contact@atelier.fr", website: "www.atelier.fr", address: "12 rue des Établis",
      template: "portrait", primaryColor: "#0E7C66",
    });
    const parsed = parseDocument(doc);
    expect(parsed.success).toBe(true);
    expect(doc.theme.template).toBe("portrait");
    expect(doc.theme.primaryColor).toBe("#0E7C66");
    expect(doc.identity.firstName).toBe("Camille");
    const contacts = doc.blocks.find((b) => b.type === "contacts");
    const kinds = contacts && contacts.type === "contacts" ? contacts.items.map((i) => i.kind) : [];
    expect(kinds).toEqual(["mobile", "email", "website", "address"]);
  });

  it("ignore les coordonnées invalides (document toujours valide)", () => {
    const doc = buildGuidedDocument({ firstName: "Léa", mobile: "pas un numéro", email: "pas-un-email", website: "javascript:alert(1)" });
    expect(parseDocument(doc).success).toBe(true);
    const contacts = doc.blocks.find((b) => b.type === "contacts");
    const items = contacts && contacts.type === "contacts" ? contacts.items : [];
    expect(items).toHaveLength(0);
  });

  it("retombe sur le modèle classique si non précisé et déduit un titre", () => {
    const doc = buildGuidedDocument({ company: "Studio B" });
    expect(doc.theme.template).toBe("classique");
    expect(guidedTitle({ firstName: "Jean", lastName: "Dupont" })).toBe("Jean Dupont");
    expect(guidedTitle({ company: "Studio B" })).toBe("Studio B");
    expect(guidedTitle({})).toBe("Nouvelle carte");
  });
});
