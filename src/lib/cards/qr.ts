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
import { isHexColor, normalizeWebUrl } from "@/lib/validation/urls";
import { getCardForActor, type Actor } from "./service";

/** URL stable encodée dans le QR code. Une variante ajoute `?c={slug}` pour tracer l'origine. */
export function qrTargetUrl(publicToken: string, variantSlug?: string | null) {
  const base = `${appUrl()}/r/${publicToken}`;
  return variantSlug ? `${base}?c=${encodeURIComponent(variantSlug)}` : base;
}

/**
 * Destination d'un QR « intelligent ».
 * - card    : la carte numérique (comportement par défaut historique).
 * - section : la carte, positionnée sur un bloc précis (ex. formulaire, galerie) via ancre.
 * - url     : une adresse externe (http/https), modifiable sans réimprimer le QR.
 */
export type QrDestType = "card" | "section" | "url" | "site";
export interface QrDest {
  type: QrDestType;
  /** Pour type "url" : adresse externe. */
  url?: string;
  /** Pour type "section" : identifiant du bloc cible sur la carte. */
  section?: string;
  /** Pour type "site" : slug du mini-site (de la même organisation). */
  site?: string;
}

/** Variante de QR code : libellé, slug stable, destination, et campagne temporaire optionnelle. */
export interface QrVariant {
  slug: string;
  label: string;
  /** Destination normale (hors campagne). */
  dest: QrDest;
  /** Campagne temporaire : remplace la destination pendant la fenêtre, puis retour automatique. */
  campaign?: { dest: QrDest; startsAt?: string; endsAt?: string };
}

/** Nombre maximal de variantes par carte (au-delà, l'intérêt du suivi s'estompe). */
export const MAX_QR_VARIANTS = 12;

const SECTION_RE = /^[A-Za-z0-9_-]{4,40}$/;
const SITE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Valide une destination de QR (carte, bloc, URL externe ou mini-site). */
function normalizeDest(raw: unknown): QrDest {
  const r = (raw ?? {}) as { type?: unknown; url?: unknown; section?: unknown; site?: unknown };
  const type: QrDestType = r.type === "url" || r.type === "section" || r.type === "site" ? r.type : "card";
  if (type === "url") {
    const url = normalizeWebUrl(String(r.url ?? ""));
    return url ? { type: "url", url } : { type: "card" };
  }
  if (type === "section") {
    const section = String(r.section ?? "").trim();
    return SECTION_RE.test(section) ? { type: "section", section } : { type: "card" };
  }
  if (type === "site") {
    const site = String(r.site ?? "").trim().toLowerCase().slice(0, 40);
    return SITE_SLUG_RE.test(site) ? { type: "site", site } : { type: "card" };
  }
  return { type: "card" };
}

/** Destination active à l'instant donné : la campagne si on est dans sa fenêtre, sinon la destination normale. */
export function activeQrDest(v: QrVariant, now = new Date()): QrDest {
  const c = v.campaign;
  if (c) {
    const t = now.getTime();
    const s = c.startsAt ? Date.parse(c.startsAt) : NaN;
    const e = c.endsAt ? Date.parse(c.endsAt) : NaN;
    const started = Number.isNaN(s) || t >= s;
    const notEnded = Number.isNaN(e) || t <= e;
    if (started && notEnded) return c.dest;
  }
  return v.dest;
}

/** Transforme un libellé en slug sûr (ascii minuscule, tirets), tronqué à 32 caractères. */
export function slugifyVariant(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

const dateOrEmpty = (v: unknown): string | undefined => {
  const s = String(v ?? "").trim().slice(0, 32);
  if (!s || Number.isNaN(Date.parse(s))) return undefined;
  return s;
};

/** Valide/normalise une liste de variantes : libellés propres, slugs uniques, destinations, bornée. */
export function normalizeQrVariants(input: unknown): QrVariant[] {
  if (!Array.isArray(input)) return [];
  const out: QrVariant[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as { label?: unknown; dest?: unknown; campaign?: unknown };
    const label = String(o.label ?? "").trim().slice(0, 40);
    if (!label) continue;
    const slug = slugifyVariant(label);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const variant: QrVariant = { slug, label, dest: normalizeDest(o.dest) };
    const c = o.campaign as { dest?: unknown; startsAt?: unknown; endsAt?: unknown } | undefined;
    if (c && typeof c === "object") {
      const cDest = normalizeDest(c.dest);
      // Une campagne n'a de sens que si elle redirige ailleurs que la carte simple.
      if (cDest.type !== "card") variant.campaign = { dest: cDest, startsAt: dateOrEmpty(c.startsAt), endsAt: dateOrEmpty(c.endsAt) };
    }
    out.push(variant);
    if (out.length >= MAX_QR_VARIANTS) break;
  }
  return out;
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

/**
 * Résultat de vérification mémorisé : le rendu et le décodage à deux tailles coûtent
 * plusieurs dizaines de millisecondes. Un média étant immuable (un recadrage crée un
 * nouveau média), le couple (adresse, couleur, logo) suffit à identifier le résultat.
 */
const verified = new Map<string, boolean>();
async function verifiedStyle(url: string, style: QrStyle, logoId: string | null, logo: Buffer | null) {
  if (!logo && style.dark.toUpperCase() === DEFAULT_QR_STYLE.dark.toUpperCase()) return { ok: true };
  const key = `${url}|${style.dark.toUpperCase()}|${logoId ?? ""}`;
  const known = verified.get(key);
  if (known !== undefined) return { ok: known };
  const { ok } = await verifyQrStyle(url, style, logo);
  if (verified.size >= 1000) verified.delete(verified.keys().next().value!);
  verified.set(key, ok);
  return { ok };
}

/** QR d'une carte : style enregistré, revérifié ; repli sur le QR standard en cas de doute. */
export async function cardQr(card: typeof schema.card.$inferSelect, format: "png" | "svg", variantSlug?: string | null) {
  const url = qrTargetUrl(card.publicToken, variantSlug);
  const style = card.qrStyle ?? DEFAULT_QR_STYLE;
  const logoId = await resolveLogoId(card, style.logo);
  const logo = logoId ? await logoPng(card.organizationId, logoId, 256) : null;
  const check = await verifiedStyle(url, style, logoId, logo);
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

/** Enregistre la liste des variantes d'origine d'une carte (après normalisation). */
export async function setCardQrVariants(actor: Actor, cardId: string, input: unknown): Promise<QrVariant[]> {
  const card = await getCardForActor(actor, cardId);
  const variants = normalizeQrVariants(input);
  await db.update(schema.card).set({ qrVariants: variants, updatedAt: new Date() }).where(eq(schema.card.id, card.id));
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: actor.supportGrantId ? "staff" : "user", action: "card.qr_variants", targetType: "card", targetId: cardId, metadata: { count: variants.length } });
  return variants;
}

// Rétrocompatibilité (QR standard noir sur blanc).
export async function qrSvg(url: string) {
  return renderQrSvg(url, DEFAULT_QR_STYLE, null);
}
export async function qrPng(url: string, width = 1024) {
  return renderQrPng(url, DEFAULT_QR_STYLE, null, width);
}
