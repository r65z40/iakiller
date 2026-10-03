import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { syncInvoice, syncSubscription } from "./sync";
import type { StripeReader } from "./stripe";
import { markServiceOrderPaid } from "@/lib/services/orders";

export interface WebhookDeps {
  reader: StripeReader;
  /** Vérifie la signature et construit l'événement (Stripe.webhooks.constructEvent). */
  constructEvent: (payload: string, signature: string) => Stripe.Event;
  now?: Date;
}

export type WebhookOutcome =
  | { httpStatus: 400; result: "invalid_signature" }
  | { httpStatus: 200; result: "duplicate" | "processed" | "ignored" }
  | { httpStatus: 500; result: "failed"; error: string };

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
]);

const INVOICE_EVENTS = new Set(["invoice.paid", "invoice.payment_failed", "invoice.finalized", "invoice.payment_succeeded", "invoice.voided", "invoice.marked_uncollectible"]);

/**
 * Traitement des webhooks Stripe :
 * 1. signature vérifiée (sinon 400, rien n'est enregistré) ;
 * 2. idempotence : l'identifiant d'événement est unique en base ; un doublon déjà traité
 *    est acquitté sans effet ;
 * 3. l'état est relu chez Stripe (pas d'application aveugle du contenu de l'événement),
 *    ce qui neutralise les événements anciens ou reçus dans le désordre ;
 * 4. en cas d'erreur, réponse 500 pour que Stripe réessaie.
 */
export async function handleStripeWebhook(payload: string, signature: string | null, deps: WebhookDeps): Promise<WebhookOutcome> {
  if (!signature) return { httpStatus: 400, result: "invalid_signature" };
  let event: Stripe.Event;
  try {
    event = deps.constructEvent(payload, signature);
  } catch {
    return { httpStatus: 400, result: "invalid_signature" };
  }

  const inserted = await db
    .insert(schema.billingEvent)
    .values({
      id: newId(),
      stripeEventId: event.id,
      type: event.type,
      livemode: event.livemode,
      stripeCreatedAt: new Date(event.created * 1000),
      status: "received",
    })
    .onConflictDoNothing({ target: schema.billingEvent.stripeEventId })
    .returning({ id: schema.billingEvent.id });

  let rowId: string;
  if (inserted.length === 0) {
    const [existing] = await db.select().from(schema.billingEvent).where(eq(schema.billingEvent.stripeEventId, event.id));
    if (existing && (existing.status === "processed" || existing.status === "ignored")) return { httpStatus: 200, result: "duplicate" };
    rowId = existing!.id; // précédente tentative en échec : on retraite
  } else {
    rowId = inserted[0].id;
  }

  try {
    const outcome = await dispatch(event, deps);
    await db
      .update(schema.billingEvent)
      .set({ status: outcome.status, organizationId: outcome.organizationId ?? null, processedAt: new Date(), error: null })
      .where(eq(schema.billingEvent.id, rowId));
    return { httpStatus: 200, result: outcome.status };
  } catch (err) {
    const message = String(err instanceof Error ? err.message : err).slice(0, 500);
    await db.update(schema.billingEvent).set({ status: "failed", error: message }).where(eq(schema.billingEvent.id, rowId));
    return { httpStatus: 500, result: "failed", error: message };
  }
}

async function dispatch(event: Stripe.Event, deps: WebhookDeps): Promise<{ status: "processed" | "ignored"; organizationId?: string }> {
  const now = deps.now ?? new Date();
  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    const sub = event.data.object as Stripe.Subscription;
    const r = await syncSubscription(deps.reader, sub.id, now);
    return { status: r.status, organizationId: "organizationId" in r ? r.organizationId : undefined };
  }

  if (INVOICE_EVENTS.has(event.type)) {
    const inv = event.data.object as Stripe.Invoice;
    const r = inv.id ? await syncInvoice(deps.reader, inv.id) : null;
    if (!r) return { status: "ignored" };
    if (r.subscriptionId) await syncSubscription(deps.reader, r.subscriptionId, now);
    return { status: "processed", organizationId: r.organizationId };
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    // L'objet est relu chez Stripe : seul son état courant fait foi.
    const session = await deps.reader.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id);
    if (session.mode === "subscription" && session.subscription) {
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const r = await syncSubscription(deps.reader, subId, now);
      return { status: r.status, organizationId: "organizationId" in r ? r.organizationId : undefined };
    }
    if (session.mode === "payment" && session.metadata?.kind === "service_order") {
      if (session.payment_status !== "paid") return { status: "ignored" };
      const orgId = await markServiceOrderPaid(session);
      return orgId ? { status: "processed", organizationId: orgId } : { status: "ignored" };
    }
    return { status: "ignored" };
  }

  return { status: "ignored" };
}
