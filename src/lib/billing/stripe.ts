import Stripe from "stripe";

/**
 * Accès Stripe. Sans clé, l'application fonctionne en « mode local » : les écrans de
 * facturation indiquent que le paiement n'est pas configuré, et AUCUN paiement n'est
 * simulé comme réussi.
 *
 * Garde-fou : une clé de production (sk_live_…) n'est acceptée que si
 * STRIPE_ALLOW_LIVE=true est explicitement positionné.
 */
let client: Stripe | null | undefined;

export type BillingMode = "disabled" | "test" | "live";

export function billingMode(): BillingMode {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return "disabled";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return process.env.STRIPE_ALLOW_LIVE === "true" ? "live" : "disabled";
  return "test";
}

export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || billingMode() === "disabled") {
    if (key && !process.env.STRIPE_ALLOW_LIVE && key.startsWith("sk_live_")) {
      console.warn("[billing] Clé Stripe de production refusée : définissez STRIPE_ALLOW_LIVE=true pour l'activer.");
    }
    client = null;
    return client;
  }
  client = new Stripe(key, { appInfo: { name: "cartes-numeriques" }, maxNetworkRetries: 2 });
  return client;
}

export function webhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

/** Sous-ensemble de l'API Stripe utilisé par la synchronisation (facilite les tests). */
export interface StripeReader {
  subscriptions: { retrieve(id: string): Promise<Stripe.Subscription>; list(params: Stripe.SubscriptionListParams): Promise<Stripe.ApiList<Stripe.Subscription>> };
  invoices: { retrieve(id: string): Promise<Stripe.Invoice> };
  checkout: { sessions: { retrieve(id: string): Promise<Stripe.Checkout.Session> } };
}

export function asReader(stripe: Stripe): StripeReader {
  return {
    subscriptions: { retrieve: (id) => stripe.subscriptions.retrieve(id), list: (p) => stripe.subscriptions.list(p) },
    invoices: { retrieve: (id) => stripe.invoices.retrieve(id) },
    checkout: { sessions: { retrieve: (id) => stripe.checkout.sessions.retrieve(id) } },
  };
}
