import type { CardDocument } from "@/lib/cards/document";
import { normalizePhone, normalizeWebUrl } from "@/lib/validation/urls";

/**
 * Générateur de signature email (HTML compatible messageries : tableaux + styles en ligne,
 * images en URL absolues). Aucune dépendance au DOM ni à la base : fonction pure, testable.
 * Toutes les valeurs texte sont échappées ; les URL sont normalisées (http/https, tel:, mailto:).
 */
export type SignatureTemplate = "classic" | "modern" | "banner" | "boxed" | "minimal" | "compact";

/** Styles proposés dans l'interface (ordre d'affichage). */
export const SIGNATURE_TEMPLATES: { id: SignatureTemplate; label: string }[] = [
  { id: "classic", label: "Classique" },
  { id: "modern", label: "Moderne" },
  { id: "banner", label: "Barre colorée" },
  { id: "boxed", label: "Encadré" },
  { id: "minimal", label: "Minimaliste" },
  { id: "compact", label: "Compacte" },
];

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
  /** URL absolue d'une image QR publique (optionnelle), ex. https://domaine/r/{token}/qr */
  qrUrl?: string;
}

export interface SignatureOptions {
  /** Afficher le logo de l'entreprise en bannière au-dessus de la signature. */
  logoBanner?: boolean;
  /** Afficher un mini QR code renvoyant vers la carte. */
  qr?: boolean;
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

/** Construit la signature. Retourne du HTML prêt à coller dans Gmail, Outlook, Apple Mail… */
export function buildSignatureHtml(input: SignatureInput, template: SignatureTemplate = "classic", options: SignatureOptions = {}): string {
  const primary = color(input.primaryColor, "#0047BB");
  const text = color(input.textColor, "#14213D");
  const muted = color(input.mutedColor, "#5b6478");
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ") || input.company || "Votre nom";
  const role = [input.jobTitle, input.company].filter(Boolean).join(" · ");
  const font = "font-family:Arial,Helvetica,sans-serif";

  const row = (label: string, value: string, href: string | null): string => {
    const inner = href ? `<a href="${esc(href)}" style="color:${text};text-decoration:none">${esc(value)}</a>` : esc(value);
    return `<tr><td style="padding:1px 0;font-size:13px;color:${muted}">${esc(label)} ${inner}</td></tr>`;
  };
  const lines: string[] = [];
  if (input.mobile) lines.push(row("Mobile", input.mobile, telHref(input.mobile)));
  if (input.phone) lines.push(row("Tél.", input.phone, telHref(input.phone)));
  if (input.email) lines.push(row("Email", input.email, `mailto:${input.email}`));
  if (input.website) { const w = normalizeWebUrl(input.website); if (w) lines.push(row("Web", input.website, w)); }
  if (input.address) lines.push(row("Adresse", input.address.replace(/\n/g, ", "), null));
  const linesTable = lines.length ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:6px">${lines.join("")}</table>` : "";

  const avatar = input.photoUrl || input.logoUrl;
  const avatarImg = (size: number) =>
    avatar ? `<img src="${esc(avatar)}" width="${size}" height="${size}" alt="${esc(name)}" style="display:block;border-radius:${input.photoUrl ? "50%" : "8px"};object-fit:cover;width:${size}px;height:${size}px" />` : "";
  const avatarCell = (size: number, padRight = 16) => (avatar ? `<td valign="top" style="padding-right:${padRight}px">${avatarImg(size)}</td>` : "");

  const cta = `<a href="${esc(input.cardUrl)}" style="display:inline-block;margin-top:8px;background:${primary};color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;padding:8px 14px;border-radius:6px">${esc(input.ctaLabel)}</a>`;
  const ctaLink = `<a href="${esc(input.cardUrl)}" style="color:${primary};font-weight:bold;text-decoration:none;font-size:13px">${esc(input.ctaLabel)} →</a>`;

  const qrCell = options.qr && input.qrUrl
    ? `<td valign="top" align="center" style="padding-left:18px"><a href="${esc(input.cardUrl)}"><img src="${esc(input.qrUrl)}" width="84" height="84" alt="QR code vers ma carte" style="display:block;width:84px;height:84px" /></a></td>`
    : "";
  const logoBannerRow = (cols: number) =>
    options.logoBanner && input.logoUrl
      ? `<tr><td colspan="${cols}" style="padding-bottom:10px"><img src="${esc(input.logoUrl)}" alt="${esc(input.company || name)}" height="40" style="display:block;height:40px;width:auto" /></td></tr>`
      : "";

  // Bloc « identité + coordonnées » réutilisé par plusieurs styles.
  const nameRole = (nameColor: string, roleColor: string) =>
    `<div style="font-size:16px;font-weight:bold;color:${nameColor}">${esc(name)}</div>` +
    (role ? `<div style="font-size:13px;color:${roleColor}">${esc(role)}</div>` : "");

  if (template === "compact") {
    const compactQr = options.qr && input.qrUrl ? `<td valign="middle" style="padding-left:16px"><a href="${esc(input.cardUrl)}"><img src="${esc(input.qrUrl)}" width="72" height="72" alt="QR code" style="display:block;width:72px;height:72px" /></a></td>` : "";
    const inline = [
      input.mobile && `<a href="${esc(telHref(input.mobile) || "#")}" style="color:${text};text-decoration:none">${esc(input.mobile)}</a>`,
      input.email && `<a href="mailto:${esc(input.email)}" style="color:${text};text-decoration:none">${esc(input.email)}</a>`,
    ].filter(Boolean).join(" &nbsp;·&nbsp; ");
    const content =
      `<td valign="top">` +
      (options.logoBanner && input.logoUrl ? `<img src="${esc(input.logoUrl)}" alt="${esc(input.company || name)}" height="34" style="display:block;height:34px;width:auto;margin-bottom:6px" />` : "") +
      `<div style="font-size:15px;font-weight:bold;color:${text}">${esc(name)}</div>` +
      (role ? `<div style="font-size:13px;color:${muted}">${esc(role)}</div>` : "") +
      `<div style="font-size:13px;padding-top:4px">${inline}</div>` +
      `<div style="padding-top:6px">${ctaLink}</div>` +
      `</td>`;
    return `<table cellpadding="0" cellspacing="0" border="0" style="${font};color:${text}"><tr>${content}${compactQr}</tr></table>`;
  }

  if (template === "minimal") {
    const inline = [
      input.mobile && `<a href="${esc(telHref(input.mobile) || "#")}" style="color:${muted};text-decoration:none">${esc(input.mobile)}</a>`,
      input.email && `<a href="mailto:${esc(input.email)}" style="color:${muted};text-decoration:none">${esc(input.email)}</a>`,
      input.website && normalizeWebUrl(input.website) && `<a href="${esc(normalizeWebUrl(input.website)!)}" style="color:${muted};text-decoration:none">${esc(input.website)}</a>`,
    ].filter(Boolean).join(" &nbsp;|&nbsp; ");
    const body =
      `<td valign="top">` +
      `<div style="font-size:15px;font-weight:bold;color:${text}">${esc(name)}${role ? `<span style="font-weight:normal;color:${muted}"> — ${esc(role)}</span>` : ""}</div>` +
      (inline ? `<div style="font-size:12px;padding-top:4px">${inline}</div>` : "") +
      `<div style="padding-top:5px">${ctaLink}</div>` +
      `</td>`;
    return `<table cellpadding="0" cellspacing="0" border="0" style="${font};color:${text}"><tr>${body}${qrCell}</tr></table>`;
  }

  if (template === "banner") {
    // Barre colorée + colonne d'espacement dédiée : le texte n'est jamais collé à la barre.
    return [
      `<table cellpadding="0" cellspacing="0" border="0" style="${font};color:${text}">`,
      logoBannerRow(4),
      `<tr>`,
      `<td style="width:4px;background:${primary};border-radius:2px" bgcolor="${primary}">&nbsp;</td>`,
      `<td style="width:16px">&nbsp;</td>`,
      `<td valign="top">`,
      `<table cellpadding="0" cellspacing="0" border="0"><tr>${avatarCell(64)}<td valign="top">`,
      nameRole(text, primary),
      linesTable,
      `<div>${cta}</div>`,
      `</td></tr></table>`,
      `</td>${qrCell}</tr></table>`,
    ].join("");
  }

  if (template === "boxed") {
    const inner = [
      `<table cellpadding="0" cellspacing="0" border="0"><tr>${avatarCell(64)}<td valign="top">`,
      nameRole(text, muted),
      linesTable,
      `<div>${cta}</div>`,
      `</td></tr></table>`,
    ].join("");
    return [
      `<table cellpadding="0" cellspacing="0" border="0" style="${font};color:${text}"><tr>`,
      `<td valign="top" style="border:1px solid #e3e8f0;border-top:3px solid ${primary};border-radius:10px;padding:16px;background:#ffffff">`,
      `<table cellpadding="0" cellspacing="0" border="0">${logoBannerRow(1)}<tr><td>${inner}</td></tr></table>`,
      `</td>${qrCell}</tr></table>`,
    ].join("");
  }

  // classic (avatar + nom + coordonnées) et modern (nom en couleur de marque, filet).
  const isModern = template === "modern";
  const header = isModern
    ? nameRole(primary, muted) + `<div style="height:2px;width:34px;background:${primary};margin:6px 0 2px"></div>`
    : nameRole(text, muted);
  return [
    `<table cellpadding="0" cellspacing="0" border="0" style="${font};color:${text}">`,
    logoBannerRow(3),
    `<tr>${avatarCell(72)}<td valign="top">`,
    header,
    linesTable,
    `<div>${cta}</div>`,
    `</td>${qrCell}</tr></table>`,
  ].join("");
}
