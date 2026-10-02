import { eq } from "drizzle-orm";
import { db, schema, type DB, type Tx } from "@/lib/db";
import { graceDays, trialRules } from "@/lib/config";
import { deriveEntitlement, type Entitlement, type SubscriptionSnapshot } from "./entitlements";

export const trialQuotas = {
  cards: trialRules.cardQuota,
  storageMb: trialRules.storageQuotaMb,
  members: trialRules.memberQuota,
};

/** Charge les données nécessaires et calcule les droits courants d'une organisation. */
export async function loadEntitlement(organizationId: string, client: DB | Tx = db, now = new Date()): Promise<Entitlement> {
  const [org] = await client
    .select({
      trialStartedAt: schema.organization.trialStartedAt,
      trialEndsAt: schema.organization.trialEndsAt,
      adminSuspendedAt: schema.organization.adminSuspendedAt,
      deletedAt: schema.organization.deletedAt,
    })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId));
  if (!org) throw new Error("Organisation introuvable");

  const rows = await client
    .select({
      sub: schema.subscription,
      plan: schema.plan,
    })
    .from(schema.subscription)
    .leftJoin(schema.planPrice, eq(schema.planPrice.id, schema.subscription.planPriceId))
    .leftJoin(schema.plan, eq(schema.plan.id, schema.planPrice.planId))
    .where(eq(schema.subscription.organizationId, organizationId));

  const subscriptions: SubscriptionSnapshot[] = rows.map(({ sub, plan }) => ({
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    cancelAt: sub.cancelAt,
    endedAt: sub.endedAt,
    pastDueSince: sub.pastDueSince,
    quotas: plan ? { cards: plan.cardQuota, storageMb: plan.storageQuotaMb, members: plan.memberQuota } : null,
    planName: plan?.name ?? null,
  }));

  return deriveEntitlement(
    {
      trialStartedAt: org.trialStartedAt,
      trialEndsAt: org.trialEndsAt,
      adminSuspendedAt: org.deletedAt ?? org.adminSuspendedAt,
      subscriptions,
      trialQuotas,
      graceDays: graceDays(),
    },
    now,
  );
}
