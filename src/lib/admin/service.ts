import { and, desc, eq, gte, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { platformCan, type PlatformPermission } from "@/lib/permissions";
import { loadEntitlement } from "@/lib/billing/load";
import { asReader, getStripe } from "@/lib/billing/stripe";
import { reconcileCustomer } from "@/lib/billing/sync";
import type { Staff } from "@/lib/services/orders";

function assert(staff: Staff, p: PlatformPermission) {
  if (!platformCan(staff.platformRole, p)) throw new DomainError("forbidden", "Permission plateforme insuffisante.");
}

const like = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

export async function searchOrganizations(staff: Staff, q: string) {
  assert(staff, "platform.view");
  const where = q.trim() ? or(ilike(schema.organization.name, like(q.trim())), ilike(schema.organization.slug, like(q.trim()))) : undefined;
  return db.select().from(schema.organization).where(where).orderBy(desc(schema.organization.createdAt)).limit(100);
}

export async function organizationDetail(staff: Staff, orgId: string) {
  assert(staff, "platform.view");
  const [org] = await db.select().from(schema.organization).where(eq(schema.organization.id, orgId));
  if (!org) throw new DomainError("not_found", "Organisation introuvable");
  const [members, cards, sites, subs, orders, ent] = await Promise.all([
    db.select({ membership: schema.membership, email: schema.user.email, name: schema.user.name }).from(schema.membership).innerJoin(schema.user, eq(schema.user.id, schema.membership.userId)).where(eq(schema.membership.organizationId, orgId)),
    db.select({ id: schema.card.id, title: schema.card.title, slug: schema.card.slug, status: schema.card.status, disabledAt: schema.card.disabledAt, adminSuspendedAt: schema.card.adminSuspendedAt, adminSuspendedReason: schema.card.adminSuspendedReason }).from(schema.card).where(eq(schema.card.organizationId, orgId)),
    db.select({ id: schema.site.id, title: schema.site.title, slug: schema.site.slug, status: schema.site.status, adminSuspendedAt: schema.site.adminSuspendedAt }).from(schema.site).where(eq(schema.site.organizationId, orgId)),
    db.select().from(schema.subscription).where(eq(schema.subscription.organizationId, orgId)),
    db.select().from(schema.serviceOrder).where(eq(schema.serviceOrder.organizationId, orgId)),
    loadEntitlement(orgId),
  ]);
  return { org, members, cards, sites, subs, orders, ent };
}

export async function setOrganizationSuspended(staff: Staff, orgId: string, suspended: boolean, reason: string) {
  assert(staff, "platform.orgs.suspend");
  if (suspended && reason.trim().length < 5) throw new DomainError("invalid", "Motif obligatoire.");
  await db.update(schema.organization).set({ adminSuspendedAt: suspended ? new Date() : null, adminSuspendedReason: suspended ? reason.trim().slice(0, 500) : null, updatedAt: new Date() }).where(eq(schema.organization.id, orgId));
  await audit({ organizationId: orgId, actorUserId: staff.id, actorType: "staff", action: suspended ? "admin.org_suspend" : "admin.org_restore", metadata: { reason } });
}

export async function setCardSuspended(staff: Staff, cardId: string, suspended: boolean, reason: string) {
  assert(staff, "platform.cards.suspend");
  if (suspended && reason.trim().length < 5) throw new DomainError("invalid", "Motif obligatoire.");
  const [card] = await db.select({ orgId: schema.card.organizationId }).from(schema.card).where(eq(schema.card.id, cardId));
  if (!card) throw new DomainError("not_found", "Carte introuvable");
  await db.update(schema.card).set({ adminSuspendedAt: suspended ? new Date() : null, adminSuspendedReason: suspended ? reason.trim().slice(0, 500) : null, updatedAt: new Date() }).where(eq(schema.card.id, cardId));
  await audit({ organizationId: card.orgId, actorUserId: staff.id, actorType: "staff", action: suspended ? "admin.card_suspend" : "admin.card_restore", targetType: "card", targetId: cardId, metadata: { reason } });
}

export async function setSiteSuspended(staff: Staff, siteId: string, suspended: boolean, reason: string) {
  assert(staff, "platform.cards.suspend");
  if (suspended && reason.trim().length < 5) throw new DomainError("invalid", "Motif obligatoire.");
  const [site] = await db.select({ orgId: schema.site.organizationId }).from(schema.site).where(eq(schema.site.id, siteId));
  if (!site) throw new DomainError("not_found", "Mini-site introuvable");
  await db.update(schema.site).set({ adminSuspendedAt: suspended ? new Date() : null, updatedAt: new Date() }).where(eq(schema.site.id, siteId));
  await audit({ organizationId: site.orgId, actorUserId: staff.id, actorType: "staff", action: suspended ? "admin.site_suspend" : "admin.site_restore", targetType: "site", targetId: siteId, metadata: { reason } });
}

export async function searchUsers(staff: Staff, q: string) {
  assert(staff, "platform.view");
  const where = q.trim() ? or(ilike(schema.user.email, like(q.trim())), ilike(schema.user.name, like(q.trim()))) : undefined;
  return db.select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, emailVerified: schema.user.emailVerified, platformRole: schema.user.platformRole, disabledAt: schema.user.disabledAt, twoFactorEnabled: schema.user.twoFactorEnabled, createdAt: schema.user.createdAt }).from(schema.user).where(where).orderBy(desc(schema.user.createdAt)).limit(100);
}

/** Désactivation d'un compte : sessions supprimées immédiatement. */
export async function setUserDisabled(staff: Staff, userId: string, disabled: boolean) {
  assert(staff, "platform.orgs.suspend");
  if (userId === staff.id) throw new DomainError("invalid", "Vous ne pouvez pas désactiver votre propre compte.");
  await db.update(schema.user).set({ disabledAt: disabled ? new Date() : null }).where(eq(schema.user.id, userId));
  if (disabled) await db.delete(schema.session).where(eq(schema.session.userId, userId));
  await audit({ actorUserId: staff.id, actorType: "staff", action: disabled ? "admin.user_disable" : "admin.user_enable", targetType: "user", targetId: userId });
}

export async function syncOrganizationBilling(staff: Staff, orgId: string) {
  assert(staff, "platform.billing.sync");
  const stripe = getStripe();
  if (!stripe) throw new DomainError("not_configured", "Stripe non configuré.");
  const [org] = await db.select().from(schema.organization).where(eq(schema.organization.id, orgId));
  if (!org?.stripeCustomerId) throw new DomainError("invalid", "Aucun client Stripe pour cette organisation.");
  const r = await reconcileCustomer(asReader(stripe), org.stripeCustomerId);
  await audit({ organizationId: orgId, actorUserId: staff.id, actorType: "staff", action: "admin.billing_sync", metadata: { count: r.length } });
  return r.length;
}

// ---------------------------------------------------------------------------
// Plans et prix
// ---------------------------------------------------------------------------

export async function updatePlan(staff: Staff, planId: string, input: { name: string; description: string; cardQuota: number; storageQuotaMb: number; memberQuota: number; isActive: boolean; isDemo: boolean }) {
  assert(staff, "platform.plans.manage");
  for (const n of [input.cardQuota, input.storageQuotaMb, input.memberQuota]) if (!Number.isInteger(n) || n < 1 || n > 100000) throw new DomainError("invalid", "Quota invalide.");
  await db.update(schema.plan).set({ ...input, name: input.name.trim().slice(0, 60), description: input.description.trim().slice(0, 300), updatedAt: new Date() }).where(eq(schema.plan.id, planId));
  await audit({ actorUserId: staff.id, actorType: "staff", action: "admin.plan_update", targetId: planId, metadata: input });
}

/**
 * Nouveau prix : on crée une NOUVELLE ligne et on désactive l'ancienne. Les abonnements
 * existants restent sur leur prix Stripe d'origine : aucun changement silencieux.
 */
export async function setPlanPrice(staff: Staff, planId: string, input: { interval: "month" | "year"; amountCents: number; taxBehavior: "exclusive" | "inclusive"; stripePriceId: string | null; isDemo: boolean }) {
  assert(staff, "platform.plans.manage");
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0 || input.amountCents > 10_000_000) throw new DomainError("invalid", "Montant invalide (centimes).");
  if (input.stripePriceId && !/^price_[A-Za-z0-9]+$/.test(input.stripePriceId)) throw new DomainError("invalid", "Identifiant de prix Stripe invalide (price_…).");
  await db.transaction(async (tx) => {
    await tx.update(schema.planPrice).set({ isActive: false }).where(and(eq(schema.planPrice.planId, planId), eq(schema.planPrice.interval, input.interval), eq(schema.planPrice.isActive, true)));
    await tx.insert(schema.planPrice).values({ id: newId(), planId, interval: input.interval, amountCents: input.amountCents, currency: "eur", taxBehavior: input.taxBehavior, stripePriceId: input.stripePriceId || null, isDemo: input.isDemo, isActive: true });
  });
  await audit({ actorUserId: staff.id, actorType: "staff", action: "admin.price_set", targetId: planId, metadata: input });
}

/**
 * Crée dans Stripe les produits et les prix récurrents manquants, puis enregistre les
 * identifiants de prix. Idempotent : un prix qui a déjà un identifiant Stripe est ignoré.
 * Un produit Stripe est réutilisé par plan (repéré par metadata.plan_id). Évite la saisie
 * manuelle des « price_… » et retire le marquage « démonstration ».
 */
export async function syncStripePrices(staff: Staff): Promise<{ created: number; skipped: number; details: string[] }> {
  assert(staff, "platform.plans.manage");
  const { getStripe, billingMode } = await import("@/lib/billing/stripe");
  const { listPlans } = await import("@/lib/billing/service");
  const stripe = getStripe();
  if (!stripe) throw new DomainError("not_configured", "Stripe n'est pas configuré (STRIPE_SECRET_KEY), ou une clé live est refusée sans STRIPE_ALLOW_LIVE=true.");
  const mode = billingMode();

  const plans = await listPlans({ activeOnly: false });
  const details: string[] = [];
  let created = 0;
  let skipped = 0;

  async function productForPlan(planId: string, name: string): Promise<string> {
    const existing = await stripe!.products.list({ active: true, limit: 100 });
    const found = existing.data.find((p) => p.metadata?.plan_id === planId);
    if (found) return found.id;
    const product = await stripe!.products.create({ name, metadata: { plan_id: planId } });
    return product.id;
  }

  for (const { plan, monthly, yearly } of plans) {
    if (!plan.isActive) continue;
    const prices = [monthly, yearly].filter((p): p is NonNullable<typeof p> => !!p);
    if (prices.length === 0) continue;
    let productId: string | null = null;
    for (const price of prices) {
      if (price.stripePriceId) { skipped++; continue; }
      if (!productId) productId = await productForPlan(plan.id, plan.name);
      const sp = await stripe.prices.create({
        product: productId,
        unit_amount: price.amountCents,
        currency: price.currency || "eur",
        recurring: { interval: price.interval === "year" ? "year" : "month" },
        tax_behavior: price.taxBehavior === "inclusive" ? "inclusive" : price.taxBehavior === "exclusive" ? "exclusive" : "unspecified",
        metadata: { plan_id: plan.id, interval: price.interval },
      });
      await db.update(schema.planPrice).set({ stripePriceId: sp.id, isDemo: false }).where(eq(schema.planPrice.id, price.id));
      created++;
      details.push(`${plan.name} ${price.interval === "year" ? "annuel" : "mensuel"} → ${sp.id}`);
    }
    if (plan.isDemo) await db.update(schema.plan).set({ isDemo: false, updatedAt: new Date() }).where(eq(schema.plan.id, plan.id));
  }

  await audit({ actorUserId: staff.id, actorType: "staff", action: "admin.stripe_prices_sync", metadata: { created, skipped, mode } });
  return { created, skipped, details };
}

export async function updateServiceOffer(staff: Staff, id: string, input: { name: string; description: string; amountCents: number; includedRevisions: number; targetDays: number | null; stripePriceId: string | null; isActive: boolean; isDemo: boolean }) {
  assert(staff, "platform.plans.manage");
  if (input.stripePriceId && !/^price_[A-Za-z0-9]+$/.test(input.stripePriceId)) throw new DomainError("invalid", "Identifiant de prix Stripe invalide.");
  await db.update(schema.serviceOffer).set({ ...input, stripePriceId: input.stripePriceId || null }).where(eq(schema.serviceOffer.id, id));
  await audit({ actorUserId: staff.id, actorType: "staff", action: "admin.offer_update", targetId: id, metadata: input });
}

// ---------------------------------------------------------------------------
// Métriques commerciales (agrégées, définitions documentées)
// ---------------------------------------------------------------------------

/**
 * - Organisations payantes actives : abonnement active/trialing/past_due non terminé.
 * - Revenu récurrent mensuel (MRR) : somme des prix des abonnements actifs (annuel ÷ 12),
 *   HORS remises, taxes et prestations ponctuelles. Indicateur de gestion, pas comptable.
 * - Conversion d'essai : organisations dont l'essai a démarré dans la période et qui ont
 *   un abonnement (quel que soit son statut actuel) ÷ essais démarrés dans la période.
 */
export async function platformMetrics(staff: Staff, days = 30) {
  assert(staff, "platform.view");
  const since = new Date(Date.now() - days * 86400_000);
  const [orgs] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.organization).where(isNull(schema.organization.deletedAt));
  const [trials] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.organization).where(gte(schema.organization.trialStartedAt, since));
  const [converted] = await db
    .select({ n: sql<number>`count(distinct ${schema.organization.id})::int` })
    .from(schema.organization)
    .innerJoin(schema.subscription, eq(schema.subscription.organizationId, schema.organization.id))
    .where(gte(schema.organization.trialStartedAt, since));
  const active = await db
    .select({ status: schema.subscription.status, amount: schema.planPrice.amountCents, interval: schema.planPrice.interval })
    .from(schema.subscription)
    .leftJoin(schema.planPrice, eq(schema.planPrice.id, schema.subscription.planPriceId))
    .where(sql`${schema.subscription.status} in ('active','trialing','past_due')`);
  const mrrCents = active.reduce((s, r) => s + (r.amount ? (r.interval === "year" ? Math.round(r.amount / 12) : r.amount) : 0), 0);
  const [cancels] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.subscription).where(and(isNotNull(schema.subscription.endedAt), gte(schema.subscription.endedAt, since)));
  const [scheduled] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.subscription).where(and(eq(schema.subscription.cancelAtPeriodEnd, true), sql`${schema.subscription.status} in ('active','trialing')`));
  const [services] = await db.select({ n: sql<number>`count(*)::int`, cents: sql<number>`coalesce(sum(${schema.serviceOrder.amountCents}),0)::int` }).from(schema.serviceOrder).where(and(isNotNull(schema.serviceOrder.paidAt), gte(schema.serviceOrder.paidAt, since)));
  const [failedEvents] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.billingEvent).where(eq(schema.billingEvent.status, "failed"));
  const [publishedCards] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.card).where(eq(schema.card.status, "published"));
  return {
    organizations: orgs.n,
    trialsStarted: trials.n,
    trialConversion: trials.n ? converted.n / trials.n : null,
    activePaying: active.length,
    mrrCents,
    cancellations: cancels.n,
    cancellationsScheduled: scheduled.n,
    serviceOrdersPaid: services.n,
    serviceRevenueCents: services.cents,
    failedBillingEvents: failedEvents.n,
    publishedCards: publishedCards.n,
    days,
  };
}

export async function auditTrail(staff: Staff, opts: { organizationId?: string; limit?: number } = {}) {
  assert(staff, "platform.audit.view");
  return db.select().from(schema.auditLog).where(opts.organizationId ? eq(schema.auditLog.organizationId, opts.organizationId) : undefined).orderBy(desc(schema.auditLog.createdAt)).limit(Math.min(opts.limit ?? 200, 1000));
}

export async function billingEvents(staff: Staff) {
  assert(staff, "platform.billing.sync");
  return db.select().from(schema.billingEvent).orderBy(desc(schema.billingEvent.receivedAt)).limit(200);
}

export async function financeExportRows(staff: Staff) {
  assert(staff, "platform.finance.export");
  await audit({ actorUserId: staff.id, actorType: "staff", action: "admin.finance_export" });
  return db
    .select({ invoice: schema.invoiceReference, orgName: schema.organization.name })
    .from(schema.invoiceReference)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.invoiceReference.organizationId))
    .orderBy(desc(schema.invoiceReference.issuedAt))
    .limit(10000);
}
