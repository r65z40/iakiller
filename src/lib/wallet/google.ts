import { createSign } from "node:crypto";
import type { CardDocument } from "@/lib/cards/document";
import { normalizePhone, isValidEmail } from "@/lib/validation/urls";

/**
 * Google Wallet : lien « Enregistrer dans Google Wallet » contenant un JWT signé par un
 * compte de service autorisé dans la Google Pay & Wallet Console :
 *   GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
 *   GOOGLE_WALLET_PRIVATE_KEY (PEM ; « \n » accepté), GOOGLE_WALLET_CLASS_SUFFIX (défaut : carte-visite).
 * Sans configuration, la fonction est simplement masquée.
 */
export function googleWalletConfig() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const email = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!issuerId || !email || !key) return null;
  return { issuerId, email, key, classSuffix: process.env.GOOGLE_WALLET_CLASS_SUFFIX || "carte-visite" };
}
export type GoogleWalletConfig = NonNullable<ReturnType<typeof googleWalletConfig>>;

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");
const safeId = (v: string) => v.replace(/[^A-Za-z0-9._-]/g, "_");

export interface GooglePassInput {
  doc: CardDocument;
  objectSuffix: string;
  cardUrl: string;
  qrUrl: string;
  origin: string;
  logoUrl: string | null;
}

export function buildGoogleSaveUrl(cfg: GoogleWalletConfig, input: GooglePassInput, now = Math.floor(Date.now() / 1000)) {
  const id = input.doc.identity;
  const name = [id.firstName, id.lastName].filter(Boolean).join(" ") || id.company || "Contact";
  const contacts = input.doc.blocks.flatMap((b) => (b.type === "contacts" && !b.hidden ? b.items : [])).filter((i) => i.value.trim());
  const phone = contacts.find((c) => (c.kind === "mobile" || c.kind === "landline") && normalizePhone(c.value));
  const email = contacts.find((c) => c.kind === "email" && isValidEmail(c.value));
  const classId = `${cfg.issuerId}.${safeId(cfg.classSuffix)}`;
  const object = {
    id: `${cfg.issuerId}.${safeId(input.objectSuffix)}`,
    classId,
    state: "ACTIVE",
    hexBackgroundColor: input.doc.theme.primaryColor,
    cardTitle: { defaultValue: { language: "fr", value: id.company || "Carte de visite" } },
    header: { defaultValue: { language: "fr", value: name } },
    subheader: id.jobTitle ? { defaultValue: { language: "fr", value: id.jobTitle } } : undefined,
    ...(input.logoUrl ? { logo: { sourceUri: { uri: input.logoUrl } } } : {}),
    barcode: { type: "QR_CODE", value: input.qrUrl, alternateText: "Carte de visite" },
    textModulesData: [
      phone && { id: "phone", header: "Téléphone", body: phone.value },
      email && { id: "email", header: "Email", body: email.value },
    ].filter(Boolean),
    linksModuleData: { uris: [{ uri: input.cardUrl, description: "Voir la carte en ligne", id: "card" }] },
  };
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: cfg.email,
    aud: "google",
    typ: "savetowallet",
    iat: now,
    origins: [input.origin],
    payload: { genericClasses: [{ id: classId }], genericObjects: [object] },
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(cfg.key);
  return `https://pay.google.com/gp/v/save/${unsigned}.${b64url(signature)}`;
}
