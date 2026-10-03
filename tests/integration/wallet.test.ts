import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateKeyPairSync, createVerify } from "node:crypto";
import sharp from "sharp";
import { buildApplePass } from "@/lib/wallet/apple";
import { buildGoogleSaveUrl } from "@/lib/wallet/google";
import { DEMO_CARDS } from "@/lib/cards/demo";

const doc = DEMO_CARDS[0].document;

/** Chaîne de certificats factice (autorité + signataire) générée pour le test uniquement. */
function fakeCertificates() {
  const dir = mkdtempSync(path.join(tmpdir(), "wallet-"));
  const run = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
  run("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem", "-days", "2", "-subj", "/CN=Fausse WWDR");
  run("req", "-newkey", "rsa:2048", "-nodes", "-keyout", "signer.key", "-out", "signer.csr", "-subj", "/CN=Pass Type ID: pass.test.carte");
  run("x509", "-req", "-in", "signer.csr", "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-out", "signer.pem", "-days", "2");
  return {
    passTypeIdentifier: "pass.test.carte",
    teamIdentifier: "TEAM123456",
    certificates: { wwdr: readFileSync(path.join(dir, "ca.pem"), "utf8"), signerCert: readFileSync(path.join(dir, "signer.pem"), "utf8"), signerKey: readFileSync(path.join(dir, "signer.key"), "utf8"), signerKeyPassphrase: undefined },
    dir,
  };
}

describe("Apple Wallet", () => {
  it("produit un .pkpass signé contenant pass.json, manifeste, signature et icônes", async () => {
    const cfg = fakeCertificates();
    const logo = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#0047BB" } }).png().toBuffer();
    const pass = await buildApplePass(cfg, { doc, serial: "carte123", cardUrl: "https://cartes.exemple.fr/a/b", qrUrl: "https://cartes.exemple.fr/r/tok", logo, photo: null });
    const file = path.join(cfg.dir, "carte.pkpass");
    writeFileSync(file, pass);
    const listing = execFileSync("unzip", ["-l", file]).toString();
    for (const name of ["pass.json", "manifest.json", "signature", "icon.png", "icon@2x.png", "logo.png"]) expect(listing).toContain(name);
    const json = JSON.parse(execFileSync("unzip", ["-p", file, "pass.json"]).toString());
    expect(json).toMatchObject({ passTypeIdentifier: "pass.test.carte", teamIdentifier: "TEAM123456", serialNumber: "carte123" });
    expect(json.barcodes[0]).toMatchObject({ format: "PKBarcodeFormatQR", message: "https://cartes.exemple.fr/r/tok" });
    expect(json.generic.primaryFields[0].value).toBe("Camille Moreau");
    const manifest = JSON.parse(execFileSync("unzip", ["-p", file, "manifest.json"]).toString());
    expect(Object.keys(manifest)).toContain("pass.json");
  });
});

describe("Google Wallet", () => {
  it("produit un lien signé RS256 vérifiable, contenant le QR stable", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const cfg = { issuerId: "3388000000012345678", email: "wallet@projet.iam.gserviceaccount.com", key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), classSuffix: "carte-visite" };
    const url = buildGoogleSaveUrl(cfg, { doc, objectSuffix: "carte-abc", cardUrl: "https://cartes.exemple.fr/a/b", qrUrl: "https://cartes.exemple.fr/r/tok", origin: "https://cartes.exemple.fr", logoUrl: null });
    expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
    const [h, p, sig] = url.split("/").pop()!.split(".");
    const ok = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(sig, "base64url"));
    expect(ok).toBe(true);
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(payload).toMatchObject({ iss: cfg.email, aud: "google", typ: "savetowallet", origins: ["https://cartes.exemple.fr"] });
    const obj = payload.payload.genericObjects[0];
    expect(obj.id).toBe("3388000000012345678.carte-abc");
    expect(obj.barcode).toMatchObject({ type: "QR_CODE", value: "https://cartes.exemple.fr/r/tok" });
    expect(obj.header.defaultValue.value).toBe("Camille Moreau");
  });
});
