import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { appUrl } from "@/lib/config";
import { getSettings } from "@/lib/settings/store";
import { missingCompanyFields } from "@/lib/settings/schema";
import { settingsBlockers } from "@/lib/settings/service";
import type { Actor } from "@/lib/cards/service";
import { asReader, getStripe } from "./stripe";
import { syncSubscription } from "./sync";

export interface PlanWithPrices {
  plan: typeof schema.plan.$inferSelect;
  monthly: typeof schema.planPrice.$inferSelect | null;
  yearly: typeof schema.planPrice.$inferSelect | null;
}

export async function listPlans(opts: { activeOnly?: boolean } = {}): Promise<PlanWithPrices[]> {
  const plans = await db
    .select()
    .from(schema.plan)
    .where(opts.activeOnly === false ? undefined : eq(schema.plan.isActive, true))
    .orderBy(asc(schema.plan.sortOrder));
  const prices = plans.length
    ? await db.select().from(schema.planPrice).where(and(inArray(schema.planPrice.planId, plans.map((p) => p.id)), eq(schema.planPrice.isActive, true)))
    : [];
  return plans.map((plan) => ({
    plan,
    monthly: prices.find((p) => p.planId === plan.id && p.interval === "month") ?? null,
    yearly: prices.find((p) => p.planId === plan.id && p.interval === "year") ?? null,
  }));
}

/** Points bloquant le lancement commercial (affichés dans l'administration). */
export async function launchBlockers(): Promise<string[]> {
  const blockers: string[] = [];
  const plans = await listPlans();
  if (plans.length === 0) blockers.push("Aucun plan actif.");
  for (const p of plans) {
    if (p.plan.isDemo) blockers.push(`Plan « ${p.plan.name} » : quotas de démonstration non validés.`);
    for (const [label, price] of [["mensuel", p.monthly], ["annuel", p.yearly]] as const) {
      if (!price) {
        blockers.push(`Plan « ${p.plan.name} » : prix ${label} manquant.`);
        continue;
      }
      if (price.isDemo) blockers.push(`Plan « ${p.plan.name} » : prix ${label} de démonstration.`);
      if (!price.stripePriceId) blockers.push(`Plan « ${p.plan.name} » : identifiant de prix Stripe manquant (${label}).`);
      if (price.taxBehavior === "unspecified") blockers.push(`Plan « ${p.plan.name} » : présentation HT/TTC non définie (${label}).`);
    }
    if (p.monthly && p.yearly && p.yearly.amountCents >= p.monthly.amountCents * 12) {
      blockers.push(`Plan « ${p.plan.name} » : l'annuel doit revenir moins cher que 12 mensualités.`);
    }
  }
  if (!process.env.STRIPE_SECRET_KEY) blockers.push("STRIPE_SECRET_KEY non configurée.");
  if (!process.env.STRIPE_WEBHOOK_SECRET) blockers.push("STRIPE_WEBHOOK_SECRET non configurée.");
  const settings = await getSettings();
  const missing = missingCompanyFields(settings);
  if (missing.length) blockers.push(`Informations de la société à compléter : ${missing.join(", ")}.`);
  blockers.push(...settingsBlockers(settings));
  if (process.env.EMAIL_MODE !== "smtp") blockers.push("Envoi d'emails réel non configuré (EMAIL_MODE=smtp).");
  return blockers;
}

export async function getSubscriptionRows(organizationId: string) {
  return db
    .select({ sub: schema.subscription, price: schema.planPrice, plan: schema.plan })
    .from(schema.subscription)
    .leftJoin(schema.planPrice, eq(schema.planPrice.id, schema.subscription.planPriceId))
    .leftJoin(schema.plan, eq(schema.plan.id, schema.planPrice.planId))
    .where(eq(schema.subscription.organizationId, organizationId))
    .orderBy(desc(schema.subscription.createdAt));
}

/** Abonnement Stripe « vivant » (non terminé) de l'organisation. */
async function liveSubscription(organizationId: string) {
  const [row] = await db
    .select()
    .from(schema.subscription)
    .where(and(eq(schema.subscription.organizationId, organizationId), ne(schema.subscription.status, "canceled"), ne(schema.subscription.status, "incomplete_expired")))
    .orderBy(desc(schema.subscription.createdAt))
    .limit(1);
  return row ?? null;
}

function requireStripe() {
  const stripe = getStripe();
  if (!stripe) throw new DomainError("not_configured", "Le paiement en ligne n'est pas encore configuré (mode local). Aucun paiement ne peut être effectué.");
  return stripe;
}

/** Client Stripe rattaché à l'organisation (et non à l'utilisateur connecté). */
export async function ensureStripeCustomer(organizationId: string): Promise<string> {
  const stripe = requireStripe();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${schema.organization} where id = ${organizationId} for update`);
    const [org] = await tx.select().from(schema.organization).where(eq(schema.organization.id, organizationId));
    if (!org) throw new DomainError("not_found", "Organisation introuvable");
    if (org.stripeCustomerId) return org.stripeCustomerId;
    const customer = await stripe.customers.create(
      { name: org.name, metadata: { orgId: org.id }, preferred_locales: ["fr"] },
      { idempotencyKey: `customer-${org.id}` },
    );
    await tx.update(schema.organization).set({ stripeCustomerId: customer.id }).where(eq(schema.organization.id, org.id));
    return customer.id;
  });
}

async function loadSellablePrice(planPriceId: string) {
  const [row] = await db
    .select({ price: schema.planPrice, plan: schema.plan })
    .from(schema.planPrice)
    .innerJoin(schema.plan, eq(schema.plan.id, schema.planPrice.planId))
    .where(and(eq(schema.planPrice.id, planPriceId), eq(schema.planPrice.isActive, true), eq(schema.plan.isActive, true)));
  if (!row) throw new DomainError("not_found", "Formule introuvable.");
  if (row.price.isDemo || row.plan.isDemo || !row.price.stripePriceId) {
    throw new DomainError("not_configured", "Tarifs de démonstration : la souscription n'est pas encore ouverte.");
  }
  return row;
}

/**
 * Crée une session de paiement hébergée. La page de retour « succès » n'accorde AUCUN droit :
 * seuls les webhooks signés (ou la réconciliation) mettent à jour l'abonnement.
 */
export async function startCheckout(actor: Actor, planPriceId: string) {
  if (!can(actor, "billing.manage")) throw new DomainError("forbidden", "Action réservée au propriétaire ou au responsable facturation.");
  const { price } = await loadSellablePrice(planPriceId);
  const live = await liveSubscription(actor.organization.id);
  if (live) throw new DomainError("invalid", "Un abonnement existe déjà : utilisez le changement de formule.");
  const stripe = requireStripe();
  const customer = await ensureStripeCustomer(actor.organization.id);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: price.stripePriceId!, quantity: 1 }],
    client_reference_id: actor.organization.id,
    metadata: { orgId: actor.organization.id, planPriceId: price.id },
    subscription_data: { metadata: { orgId: actor.organization.id, planPriceId: price.id } },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: { name: "auto", address: "auto" },
    locale: "fr",
    success_url: `${appUrl()}/app/abonnement?retour=paiement`,
    cancel_url: `${appUrl()}/app/abonnement?retour=annule`,
  });
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "billing.checkout_started", metadata: { planPriceId } });
  return session.url!;
}

export async function openBillingPortal(actor: Actor) {
  if (!can(actor, "billing.manage")) throw new DomainError("forbidden", "Action réservée.");
  const stripe = requireStripe();
  const customer = await ensureStripeCustomer(actor.organization.id);
  const portal = await stripe.billingPortal.sessions.create({ customer, return_url: `${appUrl()}/app/abonnement`, locale: "fr" });
  return portal.url;
}

async function activeCardCount(organizationId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.card)
    .where(and(eq(schema.card.organizationId, organizationId), ne(schema.card.status, "archived")));
  return r?.n ?? 0;
}

export interface ChangePreview {
  amountDueCents: number;
  currency: string;
  prorationDate: number;
  effective: string;
  rule: string;
  blocked: string | null;
  newPlanName: string;
}

/** Aperçu d'un changement de formule : montant, date d'effet et règle de prorata. */
export async function previewPlanChange(actor: Actor, planPriceId: string): Promise<ChangePreview> {
  if (!can(actor, "billing.manage")) throw new DomainError("forbidden", "Action réservée.");
  const { price, plan } = await loadSellablePrice(planPriceId);
  const live = await liveSubscription(actor.organization.id);
  if (!live) throw new DomainError("invalid", "Aucun abonnement en cours.");
  const cards = await activeCardCount(actor.organization.id);
  const blocked = cards > plan.cardQuota ? `Cette formule permet ${plan.cardQuota} carte(s) ; vous en avez ${cards} non archivée(s). Archivez les cartes que vous ne souhaitez pas conserver, puis recommencez.` : null;
  const stripe = requireStripe();
  const sub = await stripe.subscriptions.retrieve(live.stripeSubscriptionId);
  const prorationDate = Math.floor(Date.now() / 1000);
  const preview = await stripe.invoices.createPreview({
    customer: live.stripeCustomerId,
    subscription: live.stripeSubscriptionId,
    subscription_details: {
      items: [{ id: sub.items.data[0].id, price: price.stripePriceId! }],
      proration_behavior: "always_invoice",
      proration_date: prorationDate,
    },
  });
  return {
    amountDueCents: preview.amount_due,
    currency: preview.currency,
    prorationDate,
    effective: "immédiate",
    rule: "Prorata au jour près : le temps restant de l'ancienne formule est crédité et la nouvelle est facturée immédiatement pour la période en cours.",
    blocked,
    newPlanName: plan.name,
  };
}

export async function changePlan(actor: Actor, planPriceId: string, prorationDate: number) {
  if (!can(actor, "billing.manage")) throw new DomainError("forbidden", "Action réservée.");
  const { price, plan } = await loadSellablePrice(planPriceId);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${schema.organization} where id = ${actor.organization.id} for update`);
    const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.card).where(and(eq(schema.card.organizationId, actor.organization.id), ne(schema.card.status, "archived")));
    // Aucune suppression arbitraire : le client choisit lui-même les cartes à archiver.
    if ((r?.n ?? 0) > plan.cardQuota) throw new DomainError("quota_exceeded", `Archivez d'abord des cartes : cette formule en permet ${plan.cardQuota}.`);
  });
  const live = await liveSubscription(actor.organization.id);
  if (!live) throw new DomainError("invalid", "Aucun abonnement en cours.");
  const stripe = requireStripe();
  const sub = await stripe.subscriptions.retrieve(live.stripeSubscriptionId);
  await stripe.subscriptions.update(live.stripeSubscriptionId, {
    items: [{ id: sub.items.data[0].id, price: price.stripePriceId! }],
    proration_behavior: "always_invoice",
    proration_date: prorationDate,
    payment_behavior: "pending_if_incomplete",
  });
  await syncSubscription(asReader(stripe), live.stripeSubscriptionId);
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "billing.plan_change", metadata: { planPriceId } });
}

export async function setCancelAtPeriodEnd(actor: Actor, cancel: boolean) {
  if (!can(actor, "billing.manage")) throw new DomainError("forbidden", "Action réservée.");
  const live = await liveSubscription(actor.organization.id);
  if (!live) throw new DomainError("invalid", "Aucun abonnement en cours.");
  const stripe = requireStripe();
  await stripe.subscriptions.update(live.stripeSubscriptionId, { cancel_at_period_end: cancel });
  await syncSubscription(asReader(stripe), live.stripeSubscriptionId);
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: cancel ? "billing.cancel_scheduled" : "billing.cancel_reverted" });
}

export async function listInvoices(organizationId: string) {
  return db.select().from(schema.invoiceReference).where(eq(schema.invoiceReference.organizationId, organizationId)).orderBy(desc(schema.invoiceReference.issuedAt)).limit(50);
}
