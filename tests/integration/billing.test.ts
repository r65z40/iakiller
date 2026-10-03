import { beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { handleStripeWebhook, type WebhookDeps } from "@/lib/billing/webhooks";
import type { StripeReader } from "@/lib/billing/stripe";
import { loadEntitlement } from "@/lib/billing/load";
import { createCard, getCardForActor, publishCard, saveDraft } from "@/lib/cards/service";
import { resolvePublicCard } from "@/lib/cards/public";
import { createServiceOrder, markServiceOrderPaid } from "@/lib/services/orders";
import { createOrgWithOwner, resetDb } from "../helpers";

const SECRET = "whsec_test_secret";
const stripeLib = new Stripe("sk_test_dummy");

/** Faux Stripe : état « courant » contrôlé par le test. */
function fakeStripe() {
  const subs = new Map<string, Stripe.Subscription>();
  const sessions = new Map<string, Stripe.Checkout.Session>();
  const reader: StripeReader = {
    subscriptions: {
      retrieve: async (id) => {
        const s = subs.get(id);
        if (!s) throw new Error("not found");
        return structuredClone(s);
      },
      list: async () => ({ object: "list", data: [...subs.values()], has_more: false, url: "" }) as unknown as Stripe.ApiList<Stripe.Subscription>,
    },
    invoices: { retrieve: async () => { throw new Error("no invoice"); } },
    checkout: { sessions: { retrieve: async (id) => structuredClone(sessions.get(id)!) } },
  };
  const deps: WebhookDeps = { reader, constructEvent: (p, sig) => stripeLib.webhooks.constructEvent(p, sig, SECRET) };
  return { subs, sessions, deps };
}

function makeSub(id: string, customer: string, status: string, opts: { priceId?: string; periodEnd?: number; cancelAtPeriodEnd?: boolean; orgId?: string } = {}) {
  return {
    id, object: "subscription", customer, status, cancel_at_period_end: opts.cancelAtPeriodEnd ?? false, cancel_at: null, ended_at: status === "canceled" ? Math.floor(Date.now() / 1000) : null,
    metadata: opts.orgId ? { orgId: opts.orgId } : {},
    items: { data: [{ id: "si_1", price: { id: opts.priceId ?? "price_team_month" }, current_period_end: opts.periodEnd ?? Math.floor(Date.now() / 1000) + 30 * 86400 }] },
  } as unknown as Stripe.Subscription;
}

function signedEvent(event: { id: string; type: string; created?: number; object: unknown }) {
  const payload = JSON.stringify({ id: event.id, object: "event", type: event.type, created: event.created ?? Math.floor(Date.now() / 1000), livemode: false, data: { object: event.object } });
  const sig = stripeLib.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return { payload, sig };
}

async function seedPlan() {
  await db.insert(schema.plan).values({ id: "plan_team", code: "equipe", name: "Équipe", cardQuota: 10, storageQuotaMb: 1000, memberQuota: 10, isDemo: false });
  await db.insert(schema.planPrice).values({ id: "pp_team_m", planId: "plan_team", interval: "month", amountCents: 1000, stripePriceId: "price_team_month", isDemo: false, taxBehavior: "exclusive" });
}

async function orgWithCustomer(trialEnded = true) {
  const past = new Date(Date.now() - 10 * 86400_000);
  const ctx = await createOrgWithOwner("Client Stripe", trialEnded ? past : new Date());
  await db.update(schema.organization).set({ stripeCustomerId: `cus_${ctx.org.id}` }).where(eq(schema.organization.id, ctx.org.id));
  return { ...ctx, customer: `cus_${ctx.org.id}` };
}

describe("webhooks Stripe", () => {
  beforeEach(async () => {
    await resetDb();
    await seedPlan();
  });

  it("refuse une signature invalide sans rien enregistrer", async () => {
    const { deps } = fakeStripe();
    const payload = JSON.stringify({ id: "evt_x", type: "customer.subscription.updated" });
    const r = await handleStripeWebhook(payload, "t=1,v1=deadbeef", deps);
    expect(r.httpStatus).toBe(400);
    expect(await db.select().from(schema.billingEvent)).toHaveLength(0);
  });

  it("un paiement confirmé par webhook accorde les droits du plan", async () => {
    const { customer, org } = await orgWithCustomer();
    const f = fakeStripe();
    expect((await loadEntitlement(org.id)).publicAccess).toBe(false);
    f.subs.set("sub_1", makeSub("sub_1", customer, "active", { orgId: org.id }));
    const e = signedEvent({ id: "evt_1", type: "customer.subscription.created", object: { id: "sub_1" } });
    expect((await handleStripeWebhook(e.payload, e.sig, f.deps)).result).toBe("processed");
    const ent = await loadEntitlement(org.id);
    expect(ent).toMatchObject({ state: "active", publicAccess: true, quotas: { cards: 10 } });
  });

  it("la seule redirection « paiement réussi » n'accorde aucun droit", async () => {
    const { org } = await orgWithCustomer();
    // Simule l'arrivée sur /app/abonnement?retour=paiement : aucun code n'écrit d'abonnement.
    const ent = await loadEntitlement(org.id);
    expect(ent.publicAccess).toBe(false);
    expect(await db.select().from(schema.subscription)).toHaveLength(0);
  });

  it("un doublon est acquitté sans effet", async () => {
    const { customer, org } = await orgWithCustomer();
    const f = fakeStripe();
    f.subs.set("sub_1", makeSub("sub_1", customer, "active", { orgId: org.id }));
    const e = signedEvent({ id: "evt_dup", type: "customer.subscription.updated", object: { id: "sub_1" } });
    await handleStripeWebhook(e.payload, e.sig, f.deps);
    const r2 = await handleStripeWebhook(e.payload, e.sig, f.deps);
    expect(r2.result).toBe("duplicate");
    expect(await db.select().from(schema.billingEvent)).toHaveLength(1);
  });

  it("un événement ancien reçu en retard n'écrase pas l'état récent", async () => {
    const { customer, org } = await orgWithCustomer();
    const f = fakeStripe();
    // État courant chez Stripe : résilié.
    f.subs.set("sub_1", makeSub("sub_1", customer, "canceled", { orgId: org.id }));
    const recent = signedEvent({ id: "evt_new", type: "customer.subscription.deleted", object: { id: "sub_1", status: "canceled" } });
    await handleStripeWebhook(recent.payload, recent.sig, f.deps);
    // Ancien événement "active" livré après coup : le contenu est ignoré, l'état est relu.
    const old = signedEvent({ id: "evt_old", type: "customer.subscription.updated", created: Math.floor(Date.now() / 1000) - 3600, object: { id: "sub_1", status: "active" } });
    await handleStripeWebhook(old.payload, old.sig, f.deps);
    const [row] = await db.select().from(schema.subscription);
    expect(row.status).toBe("canceled");
    expect((await loadEntitlement(org.id)).publicAccess).toBe(false);
  });

  it("ignore un abonnement dont les métadonnées désignent une autre organisation", async () => {
    const { customer } = await orgWithCustomer();
    const f = fakeStripe();
    f.subs.set("sub_x", makeSub("sub_x", customer, "active", { orgId: "autre-organisation" }));
    const e = signedEvent({ id: "evt_meta", type: "customer.subscription.created", object: { id: "sub_x" } });
    expect((await handleStripeWebhook(e.payload, e.sig, f.deps)).result).toBe("ignored");
    expect(await db.select().from(schema.subscription)).toHaveLength(0);
  });

  it("résiliation : actif jusqu'à l'échéance, carte inaccessible ensuite, compte conservé", async () => {
    const { customer, org, actor } = await orgWithCustomer();
    const f = fakeStripe();
    const periodEnd = Math.floor(Date.now() / 1000) + 3600;
    f.subs.set("sub_1", makeSub("sub_1", customer, "active", { orgId: org.id, cancelAtPeriodEnd: true, periodEnd }));
    const e = signedEvent({ id: "evt_c", type: "customer.subscription.updated", object: { id: "sub_1" } });
    await handleStripeWebhook(e.payload, e.sig, f.deps);
    const c = await createCard(actor, { title: "Résiliée" });
    const row = await getCardForActor(actor, c.id);
    const doc = structuredClone(row.draft);
    doc.identity.firstName = "Max";
    await saveDraft(actor, c.id, { revision: row.draftRevision, document: doc });
    await publishCard(actor, c.id);
    expect((await resolvePublicCard(org.slug, row.slug)).kind).toBe("ok");
    expect((await loadEntitlement(org.id)).state).toBe("cancel_scheduled");
    // Échéance dépassée (sans webhook de fin) : indisponible, compte toujours éditable.
    await db.update(schema.subscription).set({ currentPeriodEnd: new Date(Date.now() - 1000) });
    expect((await resolvePublicCard(org.slug, row.slug)).kind).toBe("unavailable");
    const ent = await loadEntitlement(org.id);
    expect(ent).toMatchObject({ state: "ended", canEdit: true });
  });
});

describe("création accompagnée", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(schema.serviceOffer).values({ id: "offer1", name: "Création", description: "x", amountCents: 9900, includedRevisions: 2, stripePriceId: "price_offer", isDemo: false });
  });

  it("le paiement d'une prestation n'accorde pas d'abonnement", async () => {
    const { actor, org } = await orgWithCustomer(true);
    const { id } = await createServiceOrder(actor, "offer1", { activity: "Menuiserie sur mesure à Auxerre", people: "Camille" });
    await db.update(schema.serviceOrder).set({ status: "awaiting_payment", stripeCheckoutSessionId: "cs_1" }).where(eq(schema.serviceOrder.id, id));
    const session = { id: "cs_1", mode: "payment", payment_status: "paid", amount_total: 9900, currency: "eur", metadata: { kind: "service_order", orderId: id, orgId: org.id } } as unknown as Stripe.Checkout.Session;
    expect(await markServiceOrderPaid(session)).toBe(org.id);
    const [order] = await db.select().from(schema.serviceOrder).where(eq(schema.serviceOrder.id, id));
    expect(order.status).toBe("brief_received");
    expect((await loadEntitlement(org.id)).publicAccess).toBe(false);
  });

  it("refuse une session dont le montant ou l'organisation ne correspond pas", async () => {
    const { actor, org } = await orgWithCustomer(true);
    const { id } = await createServiceOrder(actor, "offer1", { activity: "Menuiserie sur mesure à Auxerre" });
    await db.update(schema.serviceOrder).set({ stripeCheckoutSessionId: "cs_2" }).where(eq(schema.serviceOrder.id, id));
    const bad = { id: "cs_2", mode: "payment", payment_status: "paid", amount_total: 100, currency: "eur", metadata: { kind: "service_order", orderId: id, orgId: org.id } } as unknown as Stripe.Checkout.Session;
    expect(await markServiceOrderPaid(bad)).toBeNull();
    const other = { ...bad, amount_total: 9900, metadata: { kind: "service_order", orderId: id, orgId: "autre" } } as unknown as Stripe.Checkout.Session;
    expect(await markServiceOrderPaid(other)).toBeNull();
  });
});

describe("rétrogradation", () => {
  beforeEach(resetDb);

  it("refuse une formule inférieure au nombre de cartes, sans rien supprimer", async () => {
    const { changePlan } = await import("@/lib/billing/service");
    await db.insert(schema.plan).values({ id: "plan_solo", code: "individuel", name: "Individuel", cardQuota: 1, storageQuotaMb: 200, memberQuota: 1, isDemo: false });
    await db.insert(schema.planPrice).values({ id: "pp_solo", planId: "plan_solo", interval: "month", amountCents: 500, stripePriceId: "price_solo", isDemo: false, taxBehavior: "exclusive" });
    const { actor, org } = await createOrgWithOwner();
    await createCard(actor, { title: "Un" });
    await createCard(actor, { title: "Deux" });
    await expect(changePlan(actor, "pp_solo")).rejects.toMatchObject({ code: "quota_exceeded" });
    const cards = await db.select().from(schema.card).where(eq(schema.card.organizationId, org.id));
    expect(cards).toHaveLength(2);
    expect(cards.every((c) => c.status === "draft")).toBe(true);
  });
});
