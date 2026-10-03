import { describe, expect, it, beforeEach } from "vitest";
import { safeInternalPath } from "@/lib/validation/urls";
import { clientIp, rateLimit, resetRateLimits } from "@/lib/security/rate-limit";
import { canAssignRole } from "@/lib/permissions";
import { publicDocument, collectMediaIds } from "@/lib/cards/document";
import { emptyDocument } from "@/lib/cards/defaults";

describe("safeInternalPath (anti open-redirect)", () => {
  it("accepte un chemin interne simple", () => {
    expect(safeInternalPath("/app/cartes")).toBe("/app/cartes");
    expect(safeInternalPath("/app?x=1#y")).toBe("/app?x=1#y");
  });
  it("refuse les redirections externes, y compris via caractères de contrôle", () => {
    expect(safeInternalPath("//evil.com")).toBe("/app");
    expect(safeInternalPath("https://evil.com")).toBe("/app");
    expect(safeInternalPath("/\t/evil.com")).toBe("/app"); // la tabulation est retirée par le navigateur
    expect(safeInternalPath("/\\evil.com")).toBe("/app");
    expect(safeInternalPath("/\r\n/evil.com")).toBe("/app");
    expect(safeInternalPath(null)).toBe("/app");
  });
});

describe("clientIp (anti-spoof)", () => {
  it("préfère X-Real-IP", () => {
    const h = new Headers({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "1.2.3.4, 203.0.113.5" });
    expect(clientIp(h)).toBe("203.0.113.5");
  });
  it("sans X-Real-IP, prend la dernière valeur de X-Forwarded-For (ajoutée par le proxy)", () => {
    const h = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(clientIp(h)).toBe("203.0.113.9"); // pas 6.6.6.6 (contrôlé par le client)
  });
});

describe("rateLimit (fenêtres indépendantes)", () => {
  beforeEach(resetRateLimits);
  it("bloque au-delà du maximum sur la fenêtre", () => {
    const now = Date.now();
    expect(rateLimit("k", 2, 1000, now)).toBe(true);
    expect(rateLimit("k", 2, 1000, now)).toBe(true);
    expect(rateLimit("k", 2, 1000, now)).toBe(false);
    expect(rateLimit("k", 2, 1000, now + 1001)).toBe(true);
  });
});

describe("canAssignRole (un gestionnaire ne gère pas un gestionnaire)", () => {
  const owner = { role: "owner" as const, canManageBilling: true };
  const manager = { role: "manager" as const, canManageBilling: false };
  it("le propriétaire gère tout sauf créer un propriétaire", () => {
    expect(canAssignRole(owner, "manager", "member")).toBe(true);
    expect(canAssignRole(owner, "owner", "member")).toBe(false);
  });
  it("le gestionnaire ne peut ni créer ni viser un gestionnaire", () => {
    expect(canAssignRole(manager, "member", "member")).toBe(true);
    expect(canAssignRole(manager, "manager", "member")).toBe(false); // ne peut pas promouvoir gestionnaire
    expect(canAssignRole(manager, "member", "manager")).toBe(false); // ne peut pas rétrograder un gestionnaire
    expect(canAssignRole(manager, "member", "owner")).toBe(false);
  });
});

describe("publicDocument (projection sans contenu masqué)", () => {
  it("retire les blocs masqués et la photo/logo masqués", () => {
    const doc = emptyDocument();
    doc.identity.showPhoto = false;
    doc.identity.photoMediaId = "photo-secrete";
    doc.identity.showLogo = true;
    doc.identity.logoMediaId = "logo-visible";
    doc.blocks = [
      { id: "blk-about", type: "about", hidden: true, title: "secret", body: "mobile privé", tags: [] },
      { id: "blk-gal", type: "gallery", hidden: false, title: "G", items: [{ id: "item-one", mediaId: "gal-visible", caption: "" }, { id: "item-two", mediaId: "", caption: "" }] },
      { id: "blk-doc", type: "documents", hidden: true, title: "D", items: [{ id: "item-pdf", mediaId: "pdf-secret", title: "" }] },
    ] as typeof doc.blocks;
    const pub = publicDocument(doc);
    expect(pub.identity.photoMediaId).toBe("");
    expect(pub.identity.logoMediaId).toBe("logo-visible");
    expect(pub.blocks.map((b) => b.id)).toEqual(["blk-gal"]);
    const ids = collectMediaIds(pub);
    expect(ids).toContain("logo-visible");
    expect(ids).toContain("gal-visible");
    expect(ids).not.toContain("photo-secrete");
    expect(ids).not.toContain("pdf-secret");
  });
});
