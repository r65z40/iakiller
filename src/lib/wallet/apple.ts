import { PKPass } from "passkit-generator";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { brand } from "@/lib/config";
import type { CardDocument } from "@/lib/cards/document";
import { normalizePhone, normalizeWebUrl, isValidEmail } from "@/lib/validation/urls";

/**
 * Apple Wallet (.pkpass). Nécessite un identifiant de type de pass et un certificat émis
 * par Apple (programme Apple Developer) :
 *   APPLE_WALLET_PASS_TYPE_ID, APPLE_WALLET_TEAM_ID,
 *   APPLE_WALLET_SIGNER_CERT (PEM), APPLE_WALLET_SIGNER_KEY (PEM),
 *   APPLE_WALLET_SIGNER_KEY_PASSPHRASE (facultatif), APPLE_WALLET_WWDR (PEM, certificat
 *   intermédiaire Apple WWDR). Les PEM peuvent être fournis en base64 (suffixe _B64).
 * Sans configuration, la fonction est simplement masquée.
 */
function pemFromEnv(name: string): string | null {
  const b64 = process.env[`${name}_B64`];
  if (b64) return Buffer.from(b64, "base64").toString("utf8");
  const raw = process.env[name];
  return raw ? raw.replace(/\\n/g, "\n") : null;
}

export function appleWalletConfig() {
  const passTypeIdentifier = process.env.APPLE_WALLET_PASS_TYPE_ID;
  const teamIdentifier = process.env.APPLE_WALLET_TEAM_ID;
  const signerCert = pemFromEnv("APPLE_WALLET_SIGNER_CERT");
  const signerKey = pemFromEnv("APPLE_WALLET_SIGNER_KEY");
  const wwdr = pemFromEnv("APPLE_WALLET_WWDR");
  if (!passTypeIdentifier || !teamIdentifier || !signerCert || !signerKey || !wwdr) return null;
  return { passTypeIdentifier, teamIdentifier, certificates: { signerCert, signerKey, wwdr, signerKeyPassphrase: process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE || undefined } };
}

export type AppleWalletConfig = NonNullable<ReturnType<typeof appleWalletConfig>>;

function rgb(hex: string) {
  return `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
}

/** Couleur de texte lisible (noir ou blanc) sur la couleur principale. */
function foregroundFor(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "rgb(20, 33, 61)" : "rgb(255, 255, 255)";
}

async function defaultIcon(): Promise<Buffer> {
  return readFile(path.join(process.cwd(), "public/wallet-icon.svg"));
}

export interface ApplePassInput {
  doc: CardDocument;
  serial: string;
  cardUrl: string;
  qrUrl: string;
  logo: Buffer | null;
  photo: Buffer | null;
}

export async function buildApplePass(cfg: AppleWalletConfig, input: ApplePassInput): Promise<Buffer> {
  const { doc } = input;
  const id = doc.identity;
  const name = [id.firstName, id.lastName].filter(Boolean).join(" ") || id.company || "Contact";
  const contacts = doc.blocks.flatMap((b) => (b.type === "contacts" && !b.hidden ? b.items : [])).filter((i) => i.value.trim());
  const mobile = contacts.find((c) => c.kind === "mobile" && normalizePhone(c.value));
  const landline = contacts.find((c) => c.kind === "landline" && normalizePhone(c.value));
  const email = contacts.find((c) => c.kind === "email" && isValidEmail(c.value));
  const website = contacts.find((c) => c.kind === "website" && normalizeWebUrl(c.value));
  const address = contacts.find((c) => c.kind === "address");

  const back = [
    mobile && { key: "mobile", label: "Mobile", value: mobile.value, dataDetectorTypes: ["PKDataDetectorTypePhoneNumber"] },
    landline && { key: "phone", label: "Téléphone", value: landline.value, dataDetectorTypes: ["PKDataDetectorTypePhoneNumber"] },
    email && { key: "email", label: "Email", value: email.value },
    website && { key: "web", label: "Site web", value: normalizeWebUrl(website.value)!, dataDetectorTypes: ["PKDataDetectorTypeLink"] },
    address && { key: "address", label: "Adresse", value: address.value, dataDetectorTypes: ["PKDataDetectorTypeAddress"] },
    { key: "card", label: "Carte en ligne", value: input.cardUrl, dataDetectorTypes: ["PKDataDetectorTypeLink"] },
  ].filter(Boolean);

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeIdentifier,
    teamIdentifier: cfg.teamIdentifier,
    serialNumber: input.serial,
    organizationName: id.company || brand.name,
    description: `Carte de visite de ${name}`,
    logoText: id.company || undefined,
    backgroundColor: rgb(doc.theme.primaryColor),
    foregroundColor: foregroundFor(doc.theme.primaryColor),
    labelColor: foregroundFor(doc.theme.primaryColor),
    sharingProhibited: false,
    barcodes: [{ format: "PKBarcodeFormatQR", message: input.qrUrl, messageEncoding: "iso-8859-1", altText: "Carte de visite" }],
    generic: {
      primaryFields: [{ key: "name", label: id.jobTitle || "Contact", value: name }],
      secondaryFields: [id.company && { key: "company", label: "Société", value: id.company }].filter(Boolean),
      auxiliaryFields: [mobile && { key: "mobileAux", label: "Mobile", value: mobile.value }, email && { key: "emailAux", label: "Email", value: email.value }].filter(Boolean),
      backFields: back,
    },
  };

  const iconSource = input.logo ?? (await defaultIcon());
  const icon = (size: number) => sharp(iconSource).resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  const buffers: Record<string, Buffer> = {
    "pass.json": Buffer.from(JSON.stringify(passJson)),
    "icon.png": await icon(29),
    "icon@2x.png": await icon(58),
    "icon@3x.png": await icon(87),
  };
  if (input.logo) {
    buffers["logo.png"] = await sharp(input.logo).resize(160, 50, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    buffers["logo@2x.png"] = await sharp(input.logo).resize(320, 100, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }
  if (input.photo) {
    buffers["thumbnail.png"] = await sharp(input.photo).resize(90, 90, { fit: "cover" }).png().toBuffer();
    buffers["thumbnail@2x.png"] = await sharp(input.photo).resize(180, 180, { fit: "cover" }).png().toBuffer();
  }
  const pass = new PKPass(buffers, cfg.certificates);
  return pass.getAsBuffer();
}
