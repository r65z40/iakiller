import { and, eq, gt, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { appUrl } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { deliver, sendEmail } from "@/lib/email/send";
import { templates } from "@/lib/email/templates";
import { analyticsConfig } from "@/lib/analytics/config";
import { asReader, getStripe } from "@/lib/billing/stripe";
import { reconcileCustomer } from "@/lib/billing/sync";

/**
 * Tâches planifiées (à lancer toutes les 15 minutes : `npm run jobs`).
 * Elles sont idempotentes. AUCUNE d'elles n'est nécessaire à la sécurité des droits :
 * l'expiration est appliquée à chaque lecture (voir billing/entitlements.ts).
 */

async function owners(organizationId: string) {
  return db
    .select({ email: schema.user.email })
    .from(schema.membership)
    .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
    .where(and(eq(schema.membership.organizationId, organizationId), eq(schema.membership.role, "owner")));
}

async function hasSubscription(organizationId: string) {
  const [s] = await db.select({ id: schema.subscription.id }).from(schema.subscription).where(eq(schema.subscription.organizationId, organizationId)).limit(1);
  return !!s;
}

/** Rappel 48 h avant la fin d'essai, puis avis de fin d'essai. */
export async function trialNotifications(now = new Date()) {
  let sent = 0;
  const soon = await db
    .select()
    .from(schema.organization)
    .where(and(isNull(schema.organization.deletedAt), isNotNull(schema.organization.trialEndsAt), gt(schema.organization.trialEndsAt, now), lte(schema.organization.trialEndsAt, new Date(now.getTime() + 48 * 3600_000))));
  for (const org of soon) {
    if (await hasSubscription(org.id)) continue;
    for (const o of await owners(org.id)) {
      const r = await sendEmail({ to: o.email, template: "trialEnding", email: templates.trialEnding({ orgName: org.name, endsAt: formatDateTime(org.trialEndsAt), url: `${appUrl()}/app/abonnement` }), dedupeKey: `trial-ending:${org.id}:${o.email}` });
      if (!r.skipped) sent++;
    }
  }
  const ended = await db
    .select()
    .from(schema.organization)
    .where(and(isNull(schema.organization.deletedAt), isNotNull(schema.organization.trialEndsAt), lte(schema.organization.trialEndsAt, now), gt(schema.organization.trialEndsAt, new Date(now.getTime() - 7 * 86400_000))));
  for (const org of ended) {
    if (await hasSubscription(org.id)) continue;
    for (const o of await owners(org.id)) {
      const r = await sendEmail({ to: o.email, template: "trialEnded", email: templates.trialEnded({ orgName: org.name, url: `${appUrl()}/app/abonnement` }), dedupeKey: `trial-ended:${org.id}:${o.email}` });
      if (!r.skipped) sent++;
    }
  }
  return { sent };
}

/** Réconciliation avec Stripe : rattrape un webhook manqué (abonnements synchronisés il y a plus de 6 h). */
export async function reconcileBilling(now = new Date()) {
  const stripe = getStripe();
  if (!stripe) return { skipped: "stripe non configuré" };
  const stale = await db
    .selectDistinct({ customer: schema.subscription.stripeCustomerId })
    .from(schema.subscription)
    .where(and(lt(schema.subscription.lastSyncedAt, new Date(now.getTime() - 6 * 3600_000)), sql`${schema.subscription.status} not in ('canceled','incomplete_expired')`))
    .limit(200);
  const orgsWithoutSub = await db
    .select({ customer: schema.organization.stripeCustomerId })
    .from(schema.organization)
    .where(and(isNotNull(schema.organization.stripeCustomerId), sql`not exists (select 1 from ${schema.subscription} s where s.organization_id = ${schema.organization.id})`))
    .limit(200);
  const customers = [...new Set([...stale, ...orgsWithoutSub].map((r) => r.customer).filter(Boolean) as string[])];
  let synced = 0;
  for (const c of customers) {
    try {
      synced += (await reconcileCustomer(asReader(stripe), c)).length;
    } catch (e) {
      console.error("[jobs:reconcile]", c, e);
    }
  }
  return { customers: customers.length, synced };
}

export async function retryFailedEmails() {
  const failed = await db.select({ id: schema.emailOutbox.id }).from(schema.emailOutbox).where(and(or(eq(schema.emailOutbox.status, "failed"), eq(schema.emailOutbox.status, "pending")), lt(schema.emailOutbox.attempts, 5))).limit(100);
  for (const f of failed) await deliver(f.id);
  return { retried: failed.length };
}

/**
 * Agrège les événements bruts plus anciens que la durée de conservation en compteurs
 * journaliers, puis supprime les événements bruts. Les taux par ouverture ne sont plus
 * calculables sur ces périodes (documenté dans docs/STATISTIQUES.md).
 */
export async function rollupAnalytics(now = new Date()) {
  const days = analyticsConfig().rawRetentionDays;
  const cutoff = new Date(now.getTime() - days * 86400_000);
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into ${schema.analyticsDaily} (organization_id, card_id, day, type, source, count)
      select organization_id, card_id, to_char(occurred_at at time zone 'Europe/Paris', 'YYYY-MM-DD'), type, source, count(*)::int
      from ${schema.analyticsEvent}
      where occurred_at < ${cutoff} and is_bot = false and is_internal = false
      group by 1, 2, 3, 4, 5
      on conflict (card_id, day, type, source) do update set count = ${schema.analyticsDaily}.count + excluded.count`);
    const deleted = await tx.delete(schema.analyticsEvent).where(lt(schema.analyticsEvent.occurredAt, cutoff)).returning({ id: schema.analyticsEvent.id });
    return { aggregated: deleted.length };
  });
}

/** Nettoyage technique : invitations, vérifications et sessions expirées. */
export async function cleanup(now = new Date()) {
  const inv = await db.delete(schema.invitation).where(and(lt(schema.invitation.expiresAt, new Date(now.getTime() - 30 * 86400_000)), isNull(schema.invitation.acceptedAt))).returning({ id: schema.invitation.id });
  const ver = await db.delete(schema.verification).where(lt(schema.verification.expiresAt, now)).returning({ id: schema.verification.id });
  const ses = await db.delete(schema.session).where(lt(schema.session.expiresAt, now)).returning({ id: schema.session.id });
  const grants = await db.update(schema.supportAccessGrant).set({ revokedAt: now }).where(and(lt(schema.supportAccessGrant.expiresAt, now), isNull(schema.supportAccessGrant.revokedAt))).returning({ id: schema.supportAccessGrant.id });
  return { invitations: inv.length, verifications: ver.length, sessions: ses.length, grants: grants.length };
}

export const JOBS = { trialNotifications, reconcileBilling, retryFailedEmails, rollupAnalytics, cleanup } as const;

export async function runAllJobs(now = new Date()) {
  const results: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(JOBS)) {
    const id = newId();
    await db.insert(schema.jobRun).values({ id, name, status: "running" });
    try {
      const detail = (await fn(now)) as Record<string, unknown>;
      await db.update(schema.jobRun).set({ status: "ok", finishedAt: new Date(), detail }).where(eq(schema.jobRun.id, id));
      results[name] = detail;
    } catch (e) {
      await db.update(schema.jobRun).set({ status: "failed", finishedAt: new Date(), detail: { error: String(e).slice(0, 500) } }).where(eq(schema.jobRun.id, id));
      results[name] = { error: String(e) };
    }
  }
  return results;
}

