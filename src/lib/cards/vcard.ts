import type { CardDocument } from "./document";
import { normalizePhone, normalizeWebUrl, isValidEmail } from "@/lib/validation/urls";

/** Échappement des valeurs texte vCard (RFC 6350 §3.4). */
export function escapeVCardText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Pliage des lignes à 75 octets UTF-8 sans couper un caractère multioctet. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (currentBytes + size > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74; // les lignes de continuation commencent par une espace
    }
    current += ch;
    currentBytes += size;
  }
  if (current) parts.push(current);
  return parts.join("\r\n ");
}

export interface VCardOptions {
  /** URL publique de la carte, ajoutée comme lien. */
  cardUrl?: string;
  /** Photo encodée en base64 (JPEG), facultative. */
  photoJpegBase64?: string;
}

/**
 * Génère une vCard 3.0 (meilleure compatibilité iOS/Android/Outlook).
 * Les numéros mobile et fixe sont distingués par TYPE=CELL et TYPE=WORK,VOICE.
 */
export function buildVCard(doc: CardDocument, opts: VCardOptions = {}): string {
  const { identity } = doc;
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  const first = identity.firstName.trim();
  const last = identity.lastName.trim();
  const full = [first, last].filter(Boolean).join(" ") || identity.company.trim() || "Contact";

  lines.push(`N:${escapeVCardText(last)};${escapeVCardText(first)};;;`);
  lines.push(`FN:${escapeVCardText(full)}`);
  if (identity.company.trim()) lines.push(`ORG:${escapeVCardText(identity.company.trim())}`);
  if (identity.jobTitle.trim()) lines.push(`TITLE:${escapeVCardText(identity.jobTitle.trim())}`);

  const seen = new Set<string>();
  const push = (line: string) => {
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  };

  for (const block of doc.blocks) {
    if (block.hidden) continue;
    if (block.type === "contacts") {
      for (const item of block.items) {
        const value = item.value.trim();
        if (!value) continue;
        switch (item.kind) {
          case "mobile":
          case "whatsapp":
          case "sms": {
            const n = normalizePhone(value);
            if (n) push(`TEL;TYPE=CELL:${escapeVCardText(n)}`);
            break;
          }
          case "landline": {
            const n = normalizePhone(value);
            if (n) push(`TEL;TYPE=WORK,VOICE:${escapeVCardText(n)}`);
            break;
          }
          case "email":
            if (isValidEmail(value)) push(`EMAIL;TYPE=INTERNET,WORK:${escapeVCardText(value)}`);
            break;
          case "website": {
            const u = normalizeWebUrl(value);
            if (u) push(`URL:${escapeVCardText(u)}`);
            break;
          }
          case "address": {
            // Adresse libre placée dans le champ "rue" ; le reste des composants est laissé vide.
            push(`ADR;TYPE=WORK:;;${escapeVCardText(value)};;;;`);
            break;
          }
        }
      }
    }
    if (block.type === "social") {
      for (const item of block.items) {
        const u = item.url && normalizeWebUrl(item.url);
        if (u) push(`X-SOCIALPROFILE;TYPE=${item.network}:${escapeVCardText(u)}`);
      }
    }
  }

  if (opts.cardUrl) push(`URL:${escapeVCardText(opts.cardUrl)}`);
  if (opts.photoJpegBase64) lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${opts.photoJpegBase64}`);
  lines.push("END:VCARD");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function vcardFilename(doc: CardDocument): string {
  const base = [doc.identity.firstName, doc.identity.lastName].filter(Boolean).join("-") || doc.identity.company || "contact";
  const safe = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${safe || "contact"}.vcf`;
}
