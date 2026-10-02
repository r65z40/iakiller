import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { isCardPubliclyAccessible } from "@/lib/cards/public";
import { rateLimit } from "@/lib/security/rate-limit";
import { analyticsConfig, sanitizeUtm } from "./config";

/**
 * Événements mesurés. Un clic mesure une INTENTION (ex. « Appeler »), pas un appel
 * passé ; un téléchargement de vCard ne prouve pas l'ajout au carnet d'adresses.
 */
export const EVENT_TYPES = {
  view: "Ouverture de la carte",
  click_call_mobile: "Clic « appeler » (mobile)",
  click_call_landline: "Clic « appeler » (fixe)",
  click_email: "Clic email",
  click_website: "Clic site web",
  click_social: "Clic réseau social",
  click_whatsapp: "Clic WhatsApp",
  click_sms: "Clic SMS",
  click_address: "Clic itinéraire",
  click_link: "Clic sur un lien",
  click_appointment: "Clic rendez-vous",
  video_play: "Lancement de vidéo",
  download_pdf: "Téléchargement de PDF",
  download_vcard: "Téléchargement de la fiche contact (vCard)",
  lead_submit: "Formulaire envoyé",
} as const;
export type EventType = keyof typeof EVENT_TYPES;
/** Actions comptées pour le taux de clic (hors ouverture). */
export const ACTION_TYPES = (Object.keys(EVENT_TYPES) as EventType[]).filter((t) => t !== "view" && t !== "lead_submit");

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|headless|lighthouse|monitor|scan/i;

export function classifyUserAgent(ua: string | null) {
  const s = ua ?? "";
  const isBot = !s || BOT_RE.test(s);
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(s) ? "tablet" : /mobi|iphone|android/i.test(s) ? "mobile" : "desktop";
  const browser = /edg\//i.test(s) ? "edge" : /samsungbrowser/i.test(s) ? "samsung" : /firefox|fxios/i.test(s) ? "firefox" : /chrome|crios/i.test(s) ? "chrome" : /safari/i.test(s) ? "safari" : "autre";
  return { isBot, device, browser };
}

export interface EventInput {
  token?: unknown;
  viewId?: unknown;
  type?: unknown;
  target?: unknown;
  source?: unknown;
  utm?: unknown;
}

export async function recordEvent(
  input: EventInput,
  meta: { userAgent: string | null; country: string | null; ipKey: string; isInternal: boolean; now?: Date },
): Promise<{ ok: boolean; reason?: string }> {
  const cfg = analyticsConfig();
  if (!cfg.enabled) return { ok: false, reason: "disabled" };
  const now = meta.now ?? new Date();
  if (typeof input.token !== "string" || !/^[A-Za-z0-9_-]{10,64}$/.test(input.token)) return { ok: false, reason: "token" };
  if (typeof input.viewId !== "string" || !/^[a-f0-9]{24}$/.test(input.viewId)) return { ok: false, reason: "view" };
  if (typeof input.type !== "string" || !(input.type in EVENT_TYPES) || input.type === "lead_submit") return { ok: false, reason: "type" };
  if (!rateLimit(`evt:${meta.ipKey}`, 120, 60_000, now.getTime())) return { ok: false, reason: "rate" };

  const [card] = await db.select().from(schema.card).where(eq(schema.card.publicToken, input.token));
  if (!card || !(await isCardPubliclyAccessible(card, now))) return { ok: false, reason: "card" };

  // Une action doit appartenir à un affichage déjà enregistré de la même carte.
  if (input.type !== "view") {
    const [view] = await db
      .select({ id: schema.analyticsEvent.id })
      .from(schema.analyticsEvent)
      .where(and(eq(schema.analyticsEvent.viewId, input.viewId), eq(schema.analyticsEvent.cardId, card.id), eq(schema.analyticsEvent.type, "view")))
      .limit(1);
    if (!view) return { ok: false, reason: "orphan" };
  }

  const ua = classifyUserAgent(meta.userAgent);
  const utm = (input.utm && typeof input.utm === "object" ? input.utm : {}) as Record<string, unknown>;
  const source = input.source === "qr" ? "qr" : input.source === "campaign" ? "campaign" : "direct";
  const target = typeof input.target === "string" ? input.target.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60) : "";
  const country = meta.country && /^[A-Z]{2}$/.test(meta.country) && meta.country !== "XX" ? meta.country : null;

  await db
    .insert(schema.analyticsEvent)
    .values({
      id: newId(),
      organizationId: card.organizationId,
      cardId: card.id,
      viewId: input.viewId,
      type: input.type,
      target,
      source,
      utmSource: sanitizeUtm(utm.source),
      utmMedium: sanitizeUtm(utm.medium),
      utmCampaign: sanitizeUtm(utm.campaign),
      device: ua.device,
      browser: ua.browser,
      country,
      isBot: ua.isBot,
      isInternal: meta.isInternal,
      occurredAt: now,
    })
    .onConflictDoNothing();
  return { ok: true };
}

/** Événement serveur « formulaire envoyé », rattaché à l'affichage s'il est connu. */
export async function recordLeadEvent(cardId: string, organizationId: string, viewId: string | null) {
  if (!analyticsConfig().enabled || !viewId || !/^[a-f0-9]{24}$/.test(viewId)) return;
  const [view] = await db.select().from(schema.analyticsEvent).where(and(eq(schema.analyticsEvent.viewId, viewId), eq(schema.analyticsEvent.cardId, cardId), eq(schema.analyticsEvent.type, "view"))).limit(1);
  if (!view) return;
  await db
    .insert(schema.analyticsEvent)
    .values({ ...view, id: newId(), type: "lead_submit", target: "", organizationId, occurredAt: new Date() })
    .onConflictDoNothing();
}
