import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { platformCan } from "@/lib/permissions";
import { newId } from "@/lib/ids";
import { getStripe } from "./stripe";
import type { Staff } from "@/lib/services/orders";

function requireStripe() {
  const s = getStripe();
  if (!s) throw new DomainError("not_configured", "Le paiement n'est pas configuré (mode local) : impossible de créer un code promo Stripe. Renseignez la clé Stripe d'abord.");
  return s;
}

export interface PromoInput {
  code: string;
  description?: string;
  kind: "percent" | "amount";
  percentOff?: number;
  amountOffCents?: number;
  duration: "once" | "forever" | "repeating";
  durationMonths?: number;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
}

const CODE_RE = /^[A-Z0-9_-]{3,40}$/;

function requireManage(staff: Staff) {
  if (!platformCan(staff.platformRole, "platform.plans.manage")) throw new DomainError("forbidden", "Réservé aux administrateurs.");
}

/** Crée un coupon + un code promo Stripe, puis l'enregistre localement (miroir pour l'admin). */
export async function createPromoCode(staff: Staff, input: PromoInput): Promise<string> {
  requireManage(staff);
  const code = String(input.code ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) throw new DomainError("invalid", "Code invalide : 3 à 40 caractères (lettres, chiffres, - et _).");
  const [dup] = await db.select({ id: schema.promoCode.id }).from(schema.promoCode).where(eq(schema.promoCode.code, code));
  if (dup) throw new DomainError("invalid", "Ce code existe déjà.");

  const kind = input.kind === "amount" ? "amount" : "percent";
  const percentOff = kind === "percent" ? Math.round(Number(input.percentOff)) : null;
  const amountOffCents = kind === "amount" ? Math.round(Number(input.amountOffCents)) : null;
  if (kind === "percent" && (!percentOff || percentOff < 1 || percentOff > 100)) throw new DomainError("invalid", "Le pourcentage doit être entre 1 et 100.");
  if (kind === "amount" && (!amountOffCents || amountOffCents < 1)) throw new DomainError("invalid", "Le montant de la réduction est invalide.");

  const duration = (["once", "forever", "repeating"] as const).includes(input.duration) ? input.duration : "once";
  const durationMonths = duration === "repeating" ? Math.max(1, Math.round(Number(input.durationMonths) || 1)) : null;
  const maxRedemptions = input.maxRedemptions != null && Number(input.maxRedemptions) > 0 ? Math.round(Number(input.maxRedemptions)) : null;
  const expiresAt = input.expiresAt ? new Date(`${input.expiresAt}T23:59:59Z`) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new DomainError("invalid", "Date d'expiration invalide.");

  const stripe = requireStripe();
  const coupon = await stripe.coupons.create({
    name: code,
    duration,
    ...(duration === "repeating" ? { duration_in_months: durationMonths! } : {}),
    ...(kind === "percent" ? { percent_off: percentOff! } : { amount_off: amountOffCents!, currency: "eur" }),
    ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
    ...(expiresAt ? { redeem_by: Math.floor(expiresAt.getTime() / 1000) } : {}),
  });
  const promo = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code,
    ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
    ...(expiresAt ? { expires_at: Math.floor(expiresAt.getTime() / 1000) } : {}),
  });

  const id = newId();
  await db.insert(schema.promoCode).values({
    id,
    code,
    description: (input.description ?? "").slice(0, 300),
    stripeCouponId: coupon.id,
    stripePromotionCodeId: promo.id,
    kind,
    percentOff,
    amountOffCents,
    currency: "eur",
    duration,
    durationMonths,
    maxRedemptions,
    expiresAt,
    active: true,
    timesRedeemed: 0,
    createdById: staff.id,
  });
  await audit({ actorUserId: staff.id, actorType: "staff", action: "promo.create", targetType: "promo_code", targetId: id, metadata: { code, kind, percentOff, amountOffCents, duration } });
  return id;
}

/** Liste des codes promo. `refresh` rafraîchit le nombre d'utilisations depuis Stripe (best-effort). */
export async function listPromoCodes(refresh = false) {
  const rows = await db.select().from(schema.promoCode).orderBy(desc(schema.promoCode.createdAt));
  if (refresh) {
    const stripe = getStripe();
    if (stripe) {
      for (const r of rows) {
        if (!r.stripePromotionCodeId) continue;
        try {
          const pc = await stripe.promotionCodes.retrieve(r.stripePromotionCodeId);
          if (typeof pc.times_redeemed === "number" && (pc.times_redeemed !== r.timesRedeemed || pc.active !== r.active)) {
            await db.update(schema.promoCode).set({ timesRedeemed: pc.times_redeemed, active: pc.active }).where(eq(schema.promoCode.id, r.id));
            r.timesRedeemed = pc.times_redeemed;
            r.active = pc.active;
          }
        } catch {
          /* Stripe indisponible : on garde la valeur locale. */
        }
      }
    }
  }
  return rows;
}

/** Active/désactive un code promo (sur Stripe et localement). Un code désactivé n'est plus utilisable. */
export async function setPromoActive(staff: Staff, id: string, active: boolean) {
  requireManage(staff);
  const [row] = await db.select().from(schema.promoCode).where(eq(schema.promoCode.id, id));
  if (!row) throw new DomainError("not_found", "Code introuvable.");
  const stripe = getStripe();
  if (stripe && row.stripePromotionCodeId) {
    try {
      await stripe.promotionCodes.update(row.stripePromotionCodeId, { active });
    } catch {
      /* Stripe indisponible : mise à jour locale seule. */
    }
  }
  await db.update(schema.promoCode).set({ active, updatedAt: new Date() }).where(eq(schema.promoCode.id, id));
  await audit({ actorUserId: staff.id, actorType: "staff", action: "promo.toggle", targetType: "promo_code", targetId: id, metadata: { active } });
}
