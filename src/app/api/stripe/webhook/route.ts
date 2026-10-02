import { NextResponse } from "next/server";
import { asReader, getStripe, webhookSecret } from "@/lib/billing/stripe";
import { handleStripeWebhook } from "@/lib/billing/webhooks";

/** Point d'entrée des webhooks Stripe (corps brut indispensable à la vérification de signature). */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = webhookSecret();
  if (!stripe || !secret) return NextResponse.json({ error: "Facturation non configurée" }, { status: 503 });
  const payload = await req.text();
  const outcome = await handleStripeWebhook(payload, req.headers.get("stripe-signature"), {
    reader: asReader(stripe),
    constructEvent: (p, sig) => stripe.webhooks.constructEvent(p, sig, secret),
  });
  if (outcome.httpStatus === 500) console.error("[stripe:webhook] échec", outcome.error);
  return NextResponse.json({ result: outcome.result }, { status: outcome.httpStatus });
}
