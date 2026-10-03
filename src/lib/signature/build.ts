import type { CardDocument } from "@/lib/cards/document";
import { normalizePhone, normalizeWebUrl } from "@/lib/validation/urls";

/**
 * Générateur de signature email (HTML compatible messageries : tableaux + styles en ligne,
 * images en URL absolues). Aucune dépendance au DOM ni à la base : fonction pure, testable.
 * Toutes les valeurs texte sont échappées ; les URL sont normalisées (http/https, tel:, mailto:).
 */
export type SignatureTemplate = "classic" | "compact" | "banner";

export interface SignatureInput {
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  cardUrl: string;
  photoUrl?: string;
  logoUrl?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  address?: string;
  primaryColor: string;
  textColor: string;
  mutedColor: string;
  ctaLabel: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const color = (c: string, fallback: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback);

function telHref(v: string): string | null {
  const n = normalizePhone(v);
  return n ? `tel:${n.replace(/[^\d+]/g, "")}` : null;
}

/** Extrait les champs utiles d'une carte pour pré-remplir la signature. */
export function signatureInputFromDocument(
  doc: CardDocument,
  opts: { cardUrl: string; mediaUrl: (id: string) => string; ctaLabel?: string },
): SignatureInput {
  const id = doc.identity;
  const contacts = doc.blocks.find((b) => b.type === "contacts" && !b.hidden);
  const items = contacts && contacts.type === "contacts" ? contacts.items : [];
  const first = (kind: string) => items.find((i) => i.kind === kind && i.value)?.value?.trim();
  return {
    firstName: id.firstName,
    lastName: id.lastName,
    jobTitle: id.jobTitle,
    company: id.company,
    cardUrl: opts.cardUrl,
    photoUrl: id.showPhoto && id.photoMediaId ? opts.mediaUrl(id.photoMediaId) : undefined,
    logoUrl: id.showLogo && id.logoMediaId ? opts.mediaUrl(id.logoMediaId) : undefined,
    mobile: first("mobile"),
    phone: first("landline"),
    email: first("email"),
    website: first("website"),
    address: first("address"),
    primaryColor: doc.theme.primaryColor,
    textColor: doc.theme.textColor,
    mutedColor: doc.theme.mutedColor,
    ctaLabel: opts.ctaLabel ?? "Voir ma carte de visite",
  };
}

function row(label: string, value: string, href: string | null, muted: string, text: string): string {
  const inner = href ? `<a href="${esc(href)}" style="color:${text};text-decoration:none">${esc(value)}</a>` : esc(value);
  return `<tr><td style="padding:1px 0;font-size:13px;color:${muted}">${esc(label)} ${inner}</td></tr>`;
}

/** Construit la signature. Retourne du HTML prêt à coller dans Gmail, Outlook, Apple Mail… */
export function buildSignatureHtml(input: SignatureInput, template: SignatureTemplate = "classic"): string {
  const primary = color(input.primaryColor, "#0047BB");
  const text = color(input.textColor, "#14213D");
  const muted = color(input.mutedColor, "#5b6478");
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ") || input.company || "Votre nom";
  const role = [input.jobTitle, input.company].filter(Boolean).join(" · ");

  const lines: string[] = [];
  if (input.mobile) { const h = telHref(input.mobile); lines.push(row("Mobile", input.mobile, h, muted, text)); }
  if (input.phone) { const h = telHref(input.phone); lines.push(row("Tél.", input.phone, h, muted, text)); }
  if (input.email) lines.push(row("Email", input.email, `mailto:${input.email}`, muted, text));
  if (input.website) { const w = normalizeWebUrl(input.website); if (w) lines.push(row("Web", input.website, w, muted, text)); }
  if (input.address) lines.push(row("Adresse", input.address.replace(/\n/g, ", "), null, muted, text));

  const avatar = input.photoUrl || input.logoUrl;
  const avatarCell = avatar
    ? `<td valign="top" style="padding-right:16px"><img src="${esc(avatar)}" width="72" height="72" alt="${esc(name)}" style="display:block;border-radius:${input.photoUrl ? "50%" : "8px"};object-fit:cover;width:72px;height:72px" /></td>`
    : "";

  const cta = `<a href="${esc(input.cardUrl)}" style="display:inline-block;margin-top:8px;background:${primary};color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;padding:8px 14px;border-radius:6px">${esc(input.ctaLabel)}</a>`;

  if (template === "compact") {
    return [
      `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:${text}">`,
      `<tr><td style="font-size:15px;font-weight:bold;color:${text}">${esc(name)}</td></tr>`,
      role ? `<tr><td style="font-size:13px;color:${muted}">${esc(role)}</td></tr>` : "",
      `<tr><td style="font-size:13px;padding-top:4px">`,
      [input.mobile && `<a href="${esc(telHref(input.mobile) || "#")}" style="color:${text};text-decoration:none">${esc(input.mobile)}</a>`, input.email && `<a href="mailto:${esc(input.email)}" style="color:${text};text-decoration:none">${esc(input.email)}</a>`].filter(Boolean).join(" &nbsp;·&nbsp; "),
      `</td></tr>`,
      `<tr><td style="padding-top:6px"><a href="${esc(input.cardUrl)}" style="color:${primary};font-weight:bold;text-decoration:none;font-size:13px">${esc(input.ctaLabel)} →</a></td></tr>`,
      `</table>`,
    ].join("");
  }

  if (template === "banner") {
    return [
      `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:${text};border-left:3px solid ${primary};padding-left:14px">`,
      `<tr>${avatarCell}<td valign="top">`,
      `<div style="font-size:16px;font-weight:bold;color:${text}">${esc(name)}</div>`,
      role ? `<div style="font-size:13px;color:${primary};font-weight:bold">${esc(role)}</div>` : "",
      `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:6px">${lines.join("")}</table>`,
      `<div>${cta}</div>`,
      `</td></tr></table>`,
    ].join("");
  }

  // classic
  return [
    `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:${text}">`,
    `<tr>${avatarCell}<td valign="top">`,
    `<div style="font-size:16px;font-weight:bold;color:${text}">${esc(name)}</div>`,
    role ? `<div style="font-size:13px;color:${muted}">${esc(role)}</div>` : "",
    `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:6px">${lines.join("")}</table>`,
    `<div>${cta}</div>`,
    `</td></tr></table>`,
  ].join("");
}
