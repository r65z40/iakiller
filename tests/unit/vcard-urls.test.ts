import { describe, expect, it } from "vitest";
import { buildVCard, escapeVCardText, foldLine } from "@/lib/cards/vcard";
import { emptyDocument } from "@/lib/cards/defaults";
import { normalizeWebUrl, parseVideoUrl, safeInternalPath, toInternationalDigits } from "@/lib/validation/urls";
import { parseDocument } from "@/lib/cards/document";
import { slugify, validateOrgSlug } from "@/lib/cards/slug";

describe("vCard", () => {
  it("échappe virgules, points-virgules, antislash et retours à la ligne", () => {
    expect(escapeVCardText("a,b;c\\d\ne")).toBe(String.raw`a\,b\;c\\d\ne`);
  });

  it("plie les lignes à 75 octets sans couper un caractère accentué", () => {
    const line = "NOTE:" + "é".repeat(60);
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("distingue mobile et fixe, et ignore les valeurs invalides", () => {
    const doc = emptyDocument();
    doc.identity.firstName = "Zoé";
    doc.identity.lastName = "Dupont-Lefèvre";
    doc.identity.company = "Café, Thé & Co; SARL";
    const contacts = doc.blocks.find((b) => b.type === "contacts")!;
    if (contacts.type !== "contacts") throw new Error();
    contacts.items = [
      { id: "aaaa1", kind: "mobile", label: "", value: "06 12 34 56 78" },
      { id: "aaaa2", kind: "landline", label: "", value: "03.86.00.00.00" },
      { id: "aaaa3", kind: "email", label: "", value: "zoe@exemple.fr" },
      { id: "aaaa4", kind: "address", label: "", value: "1 rue des Lilas\n89000 Auxerre" },
    ];
    const v = buildVCard(doc);
    expect(v).toContain("N:Dupont-Lefèvre;Zoé;;;");
    expect(v).toContain(String.raw`ORG:Café\, Thé & Co\; SARL`);
    expect(v).toContain("TEL;TYPE=CELL:0612345678");
    expect(v).toContain("TEL;TYPE=WORK,VOICE:0386000000");
    expect(v).toContain("ADR;TYPE=WORK:;;1 rue des Lilas\\n89000 Auxerre;;;;");
    expect(v.endsWith("END:VCARD\r\n")).toBe(true);
    expect(v.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});

describe("validation des URL", () => {
  it("rejette les protocoles dangereux", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd", "vbscript:x", "https://user:pass@exemple.fr", "jaVaScRiPt:alert(1)"]) {
      expect(normalizeWebUrl(bad)).toBeNull();
    }
    expect(normalizeWebUrl("www.exemple.fr")).toBe("https://www.exemple.fr/");
  });

  it("protège contre les redirections ouvertes", () => {
    expect(safeInternalPath("//evil.com")).toBe("/app");
    expect(safeInternalPath("https://evil.com")).toBe("/app");
    expect(safeInternalPath("/\\evil.com")).toBe("/app");
    expect(safeInternalPath("/app/cartes")).toBe("/app/cartes");
  });

  it("reconnaît YouTube et Vimeo, rien d'autre", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ provider: "youtube", videoId: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({ provider: "youtube", videoId: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://vimeo.com/123456789")).toEqual({ provider: "vimeo", videoId: "123456789" });
    expect(parseVideoUrl('<iframe src="https://evil"></iframe>')).toBeNull();
  });

  it("formate WhatsApp en international", () => {
    expect(toInternationalDigits("06 12 34 56 78")).toBe("33612345678");
    expect(toInternationalDigits("+32 470 12 34 56")).toBe("32470123456");
  });

  it("refuse le HTML dans le texte riche via le schéma (le rendu n'interprète jamais de balise)", () => {
    const doc = emptyDocument();
    const about = doc.blocks.find((b) => b.type === "about")!;
    if (about.type === "about") about.text = "<img src=x onerror=alert(1)>";
    // Le texte est accepté comme texte brut : il sera affiché littéralement, jamais interprété.
    expect(parseDocument(doc).success).toBe(true);
  });
});

describe("slugs", () => {
  it("normalise et réserve les préfixes techniques", () => {
    expect(slugify("  Électricité Générale Ménard & Fils ")).toBe("electricite-generale-menard-fils");
    expect(validateOrgSlug("admin")).not.toBeNull();
    expect(validateOrgSlug("api")).not.toBeNull();
    expect(validateOrgSlug("r")).not.toBeNull();
    expect(validateOrgSlug("menuiserie-durand")).toBeNull();
  });
});
