import QRCode from "qrcode";
import sharp from "sharp";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { and, eq, isNull } from "drizzle-orm";
import { appUrl } from "@/lib/config";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/media/storage";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { isHexColor } from "@/lib/validation/urls";
import { getCardForActor, type Actor } from "./service";

/** URL stable encodée dans le QR code. */
export function qrTargetUrl(publicToken: string) {
  return `${appUrl()}/r/${publicToken}`;
}

export interface QrStyle {
  dark: string;
  logo: "none" | "card" | "brand";
}

export const DEFAULT_QR_STYLE: QrStyle = { dark: "#000000", logo: "none" };

/** Part de la largeur occupée par le logo : bien en dessous de la capacité de correction H (≈30 %). */
const LOGO_RATIO = 0.22;

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Contraste du module foncé sur fond blanc (WCAG). Les lecteurs exigent un module nettement plus foncé que le fond. */
export function qrContrast(dark: string) {
  return 1.05 / (luminance(dark) + 0.05);
}

async function logoPng(organizationId: string, mediaId: string | null, sizePx: number) {
  if (!mediaId) return null;
  const [m] = await db
    .select()
    .from(schema.mediaAsset)
    .where(and(eq(schema.mediaAsset.id, mediaId), eq(schema.mediaAsset.organizationId, organizationId), isNull(schema.mediaAsset.deletedAt)));
  if (!m || m.kind !== "image") return null;
  const buf = await storage().get(m.storageKey);
  if (!buf) return null;
  const inner = Math.round(sizePx * 0.82);
  const logo = await sharp(buf).resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).flatten({ background: "#ffffff" }).png().toBuffer();
  // Pastille blanche arrondie autour du logo, pour isoler les modules.
  const radius = Math.round(sizePx * 0.18);
  const plate = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}"><rect width="${sizePx}" height="${sizePx}" rx="${radius}" fill="#fff"/></svg>`);
  return sharp(plate).composite([{ input: logo, gravity: "center" }]).png().toBuffer();
}

async function resolveLogoId(card: { organizationId: string; draft: { identity: { logoMediaId: string | null } } }, logo: QrStyle["logo"]) {
  if (logo === "none") return null;
  if (logo === "card") return card.draft.identity.logoMediaId;
  const [b] = await db.select({ id: schema.brandSettings.logoMediaId }).from(schema.brandSettings).where(eq(schema.brandSettings.organizationId, card.organizationId));
  return b?.id ?? null;
}

export async function renderQrPng(url: string, style: QrStyle, logo: Buffer | null, width = 1024): Promise<Buffer> {
  const base = await QRCode.toBuffer(url, { type: "png", width, margin: 4, errorCorrectionLevel: logo ? "H" : "M", color: { dark: style.dark, light: "#FFFFFF" } });
  if (!logo) return base;
  const size = Math.round(width * LOGO_RATIO);
  const resized = await sharp(logo).resize(size, size).png().toBuffer();
  return sharp(base).composite([{ input: resized, gravity: "center" }]).png().toBuffer();
}

export async function renderQrSvg(url: string, style: QrStyle, logo: Buffer | null): Promise<string> {
  const svg = await QRCode.toString(url, { type: "svg", margin: 4, errorCorrectionLevel: logo ? "H" : "M", color: { dark: style.dark, light: "#FFFFFF" } });
  if (!logo) return svg;
  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const n = vb ? Number(vb[1]) : 33;
  const s = n * LOGO_RATIO;
  const o = (n - s) / 2;
  const img = `<image x="${o}" y="${o}" width="${s}" height="${s}" href="data:image/png;base64,${logo.toString("base64")}"/>`;
  return svg.replace("</svg>", `${img}</svg>`);
}

/** Décode l'image produite : vérifie qu'un lecteur retrouve exactement l'URL. */
export function decodesTo(png: Buffer, url: string) {
  const img = PNG.sync.read(png);
  return jsQR(new Uint8ClampedArray(img.data), img.width, img.height)?.data === url;
}

/** Vérification complète d'un style : contraste puis lecture effective, à plusieurs tailles. */
export async function verifyQrStyle(url: string, style: QrStyle, logo: Buffer | null) {
  if (!isHexColor(style.dark)) return { ok: false as const, reason: "Couleur invalide." };
  if (qrContrast(style.dark) < 4.5) return { ok: false as const, reason: "Couleur trop claire : le QR code doit être nettement plus foncé que le fond blanc (contraste 4,5:1 minimum)." };
  for (const w of [300, 600]) {
    if (!decodesTo(await renderQrPng(url, style, logo, w), url)) {
      return { ok: false as const, reason: "Le QR code ne se lit pas de façon fiable avec ce logo. Essayez sans logo ou avec un logo plus simple." };
    }
  }
  return { ok: true as const };
}

/** QR d'une carte : style enregistré, revérifié ; repli sur le QR standard en cas de doute. */
export async function cardQr(card: typeof schema.card.$inferSelect, format: "png" | "svg") {
  const url = qrTargetUrl(card.publicToken);
  const style = card.qrStyle ?? DEFAULT_QR_STYLE;
  const logoId = await resolveLogoId(card, style.logo);
  const logo = logoId ? await logoPng(card.organizationId, logoId, 256) : null;
  const check = style === DEFAULT_QR_STYLE ? { ok: true } : await verifyQrStyle(url, style, logo);
  const effective = check.ok ? style : DEFAULT_QR_STYLE;
  const effectiveLogo = check.ok ? logo : null;
  return format === "png" ? await renderQrPng(url, effective, effectiveLogo) : await renderQrSvg(url, effective, effectiveLogo);
}

export async function setCardQrStyle(actor: Actor, cardId: string, input: QrStyle) {
  const card = await getCardForActor(actor, cardId);
  const style: QrStyle = { dark: input.dark.toUpperCase(), logo: input.logo === "card" || input.logo === "brand" ? input.logo : "none" };
  const logoId = await resolveLogoId(card, style.logo);
  if (style.logo !== "none" && !logoId) throw new DomainError("invalid", style.logo === "card" ? "La carte n'a pas de logo." : "Aucun logo défini dans l'identité d'entreprise.");
  const logo = logoId ? await logoPng(card.organizationId, logoId, 256) : null;
  const check = await verifyQrStyle(qrTargetUrl(card.publicToken), style, logo);
  if (!check.ok) throw new DomainError("invalid", check.reason);
  await db.update(schema.card).set({ qrStyle: style, updatedAt: new Date() }).where(eq(schema.card.id, card.id));
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: actor.supportGrantId ? "staff" : "user", action: "card.qr_style", targetType: "card", targetId: cardId, metadata: { ...style } });
}

// Rétrocompatibilité (QR standard noir sur blanc).
export async function qrSvg(url: string) {
  return renderQrSvg(url, DEFAULT_QR_STYLE, null);
}
export async function qrPng(url: string, width = 1024) {
  return renderQrPng(url, DEFAULT_QR_STYLE, null, width);
}
