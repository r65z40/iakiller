import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { appUrl, graceDays } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { sendEmail } from "@/lib/email/send";
import { templates } from "@/lib/email/templates";
import type { StripeReader } from "./stripe";

const ts = (v: number | null | undefined) => (v ? new Date(v * 1000) : null);
const customerId = (c: string | Stripe.Customer | Stripe.DeletedCustomer) => (typeof c === "string" ? c : c.id);

async function billingRecipients(organizationId: string) {
  const rows = await db
    .select({ email: schema.user.email, role: schema.membership.role, canBill: schema.membership.canManageBilling })
    .from(schema.membership)
    .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
    .where(eq(schema.membership.organizationId, organizationId));
  return rows.filter((r) => r.role === "owner" || r.canBill).map((r) => r.email);
}

/**
 * Retrouve l'organisation d'un client Stripe. La correspondance fiable est
 * organization.stripe_customer_id, défini par le serveur lors du premier paiement.
 * Les métadonnées seules ne suffisent pas (elles ne sont qu'un indice de cohérence).
 */
async function organizationForCustomer(stripeCustomerId: string) {
  const [org] = await db.select().from(schema.organization).where(eq(schema.organization.stripeCustomerId, stripeCustomerId));
  return org ?? null;
}

/**
 * Synchronise un abonnement en relisant son état COURANT chez Stripe. Le contenu des
 * événements n'est jamais appliqué tel quel : un événement ancien, dupliqué ou reçu dans
 * le désordre ne peut donc pas écraser un état plus récent.
 */
export async function syncSubscription(reader: StripeReader, stripeSubscriptionId: string, now = new Date()) {
  const sub = await reader.subscriptions.retrieve(stripeSubscriptionId);
  const custId = customerId(sub.customer);
  const org = await organizationForCustomer(custId);
  if (!org) return { status: "ignored" as const, reason: "client Stripe inconnu" };
  if (sub.metadata?.orgId && sub.metadata.orgId !== org.id) {
    await audit({ organizationId: org.id, actorType: "stripe", action: "billing.metadata_mismatch", targetId: sub.id, metadata: { metadataOrg: sub.metadata.orgId } });
    return { status: "ignored" as const, reason: "métadonnées incohérentes" };
  }

  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;
  const [price] = priceId ? await db.select().from(schema.planPrice).where(eq(schema.planPrice.stripePriceId, priceId)) : [];
  const [existing] = await db.select().from(schema.subscription).where(eq(schema.subscription.stripeSubscriptionId, sub.id));

  const status = sub.status;
  const pastDueSince = status === "past_due" || status === "unpaid" ? (existing?.pastDueSince ?? now) : null;
  const values = {
    organizationId: org.id,
    stripeCustomerId: custId,
    stripePriceId: priceId,
    planPriceId: price?.id ?? null,
    status,
    currentPeriodEnd: ts(item?.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cancelAt: ts(sub.cancel_at),
    endedAt: ts(sub.ended_at),
    pastDueSince,
    lastSyncedAt: now,
    updatedAt: now,
  };
  await db
    .insert(schema.subscription)
    .values({ id: newId(), stripeSubscriptionId: sub.id, ...values })
    .onConflictDoUpdate({ target: schema.subscription.stripeSubscriptionId, set: values });

  // Notifications sur transition (idempotentes grâce aux clés de déduplication).
  const prev = existing?.status ?? null;
  const url = `${appUrl()}/app/abonnement`;
  const recipients = await billingRecipients(org.id);
  const planName = price ? (await db.select({ name: schema.plan.name }).from(schema.plan).where(eq(schema.plan.id, price.planId)))[0]?.name ?? "" : "";
  for (const to of recipients) {
    if ((status === "active" || status === "trialing") && prev !== "active" && prev !== "trialing") {
      await sendEmail({ to, template: "subscriptionConfirmed", email: templates.subscriptionConfirmed({ orgName: org.name, planName, url }), dedupeKey: `sub-confirmed:${sub.id}:${to}` });
    }
    if (sub.cancel_at_period_end && !existing?.cancelAtPeriodEnd && values.currentPeriodEnd) {
      await sendEmail({ to, template: "cancellationScheduled", email: templates.cancellationScheduled({ orgName: org.name, endsAt: formatDateTime(values.cancelAt ?? values.currentPeriodEnd), url }), dedupeKey: `sub-cancel:${sub.id}:${values.currentPeriodEnd.getTime()}:${to}` });
    }
    if ((status === "canceled" || status === "incomplete_expired") && prev && prev !== status) {
      await sendEmail({ to, template: "subscriptionEnded", email: templates.subscriptionEnded({ orgName: org.name, url }), dedupeKey: `sub-ended:${sub.id}:${to}` });
    }
    if (status === "past_due" && prev !== "past_due" && pastDueSince) {
      const graceUntil = new Date(pastDueSince.getTime() + graceDays() * 86400_000);
      await sendEmail({ to, template: "paymentFailed", email: templates.paymentFailed({ orgName: org.name, graceUntil: formatDateTime(graceUntil), url }), dedupeKey: `sub-pastdue:${sub.id}:${pastDueSince.getTime()}:${to}` });
    }
  }
  if (prev !== status || existing?.cancelAtPeriodEnd !== sub.cancel_at_period_end) {
    await audit({ organizationId: org.id, actorType: "stripe", action: "billing.subscription_sync", targetType: "subscription", targetId: sub.id, metadata: { from: prev, to: status, cancelAtPeriodEnd: sub.cancel_at_period_end } });
  }
  return { status: "processed" as const, organizationId: org.id };
}

export async function syncInvoice(reader: StripeReader, invoiceId: string) {
  const inv = await reader.invoices.retrieve(invoiceId);
  if (!inv.customer) return null;
  const org = await organizationForCustomer(customerId(inv.customer));
  if (!org) return null;
  const values = {
    organizationId: org.id,
    number: inv.number,
    status: inv.status ?? "draft",
    amountDueCents: inv.amount_due,
    amountPaidCents: inv.amount_paid,
    currency: inv.currency,
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    invoicePdfUrl: inv.invoice_pdf ?? null,
    issuedAt: ts(inv.status_transitions?.finalized_at ?? inv.created),
  };
  await db
    .insert(schema.invoiceReference)
    .values({ id: newId(), stripeInvoiceId: inv.id!, ...values })
    .onConflictDoUpdate({ target: schema.invoiceReference.stripeInvoiceId, set: values });
  const subRef = inv.parent?.subscription_details?.subscription;
  return { organizationId: org.id, subscriptionId: subRef ? (typeof subRef === "string" ? subRef : subRef.id) : null };
}

/** Réconciliation : relit tous les abonnements d'un client chez Stripe (webhook manqué). */
export async function reconcileCustomer(reader: StripeReader, stripeCustomerId: string) {
  const list = await reader.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 20 });
  const results = [];
  for (const s of list.data) results.push(await syncSubscription(reader, s.id));
  return results;
}
