import { describe, expect, it } from "vitest";
import { isSameOrigin } from "@/lib/security/origin";

function req(headers: Record<string, string>) {
  return new Request("http://x/api", { method: "POST", headers });
}

describe("isSameOrigin", () => {
  it("accepte une vraie même origine, quel que soit l'hôte (IP de réseau local)", () => {
    expect(isSameOrigin(req({ origin: "http://192.168.1.50:3000", host: "192.168.1.50:3000" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://cartes.exemple.fr", host: "cartes.exemple.fr" }))).toBe(true);
  });

  it("refuse une requête inter-sites (origine ≠ hôte servi)", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example", host: "192.168.1.50:3000" }))).toBe(false);
  });

  it("accepte localhost (URL technique par défaut)", () => {
    expect(isSameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
  });

  it("retombe sur Sec-Fetch-Site quand il n'y a pas d'Origin", () => {
    expect(isSameOrigin(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("refuse une origine mal formée", () => {
    expect(isSameOrigin(req({ origin: "pas-une-url", host: "192.168.1.50:3000" }))).toBe(false);
  });
});
