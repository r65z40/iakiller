import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSettings } from "@/lib/settings/store";
import { audit } from "@/lib/audit";
import { loadEntitlement } from "@/lib/billing/load";
import { storage } from "@/lib/media/storage";
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
  // Purge des emails deja envoyes ou journalises de plus de 30 jours : leurs corps contiennent
  // des liens sensibles (confirmation, reinitialisation, invitation) qu'il est inutile de garder.
  const mails = await db
    .delete(schema.emailOutbox)
    .where(and(inArray(schema.emailOutbox.status, ["sent", "logged"]), lt(schema.emailOutbox.createdAt, new Date(now.getTime() - 30 * 86400_000))))
    .returning({ id: schema.emailOutbox.id });
  return { invitations: inv.length, verifications: ver.length, sessions: ses.length, grants: grants.length, emails: mails.length };
}

/**
 * Politique de conservation réglée dans l'administration. Chaque règle ne s'applique que
 * si une durée est renseignée (vide = aucune suppression automatique).
 * - prospects et journal d'audit au-delà de leur durée : supprimés ;
 * - organisations sans droit actif (essai terminé ou abonnement terminé) depuis N jours :
 *   suppression logique (cartes indisponibles) — les impayés et suspensions administratives
 *   ne sont pas concernés ;
 * - organisations supprimées depuis N jours : contenus effacés (cartes, médias et fichiers,
 *   prospects, statistiques, membres) ; les références comptables (factures, abonnements,
 *   commandes de prestation) sont conservées.
 */
export async function applyRetention(now = new Date()) {
  const r = (await getSettings(true)).retention;
  const before = (days: number) => new Date(now.getTime() - days * 86400_000);
  const result = { leads: 0, audit: 0, orgsDeleted: 0, orgsPurged: 0 };

  if (r.leadsDays !== null) {
    result.leads = (await db.delete(schema.lead).where(lt(schema.lead.createdAt, before(r.leadsDays))).returning({ id: schema.lead.id })).length;
  }
  if (r.auditDays !== null) {
    result.audit = (await db.delete(schema.auditLog).where(lt(schema.auditLog.createdAt, before(r.auditDays))).returning({ id: schema.auditLog.id })).length;
  }

  if (r.contentAfterEndDays !== null) {
    const limit = before(r.contentAfterEndDays);
    const candidates = await db
      .select()
      .from(schema.organization)
      .where(and(isNull(schema.organization.deletedAt), isNull(schema.organization.adminSuspendedAt), lt(schema.organization.trialEndsAt, limit)))
      .limit(200);
    for (const org of candidates) {
      const ent = await loadEntitlement(org.id, db, now);
      if (ent.state !== "trial_expired" && ent.state !== "ended") continue;
      const subs = await db.select().from(schema.subscription).where(eq(schema.subscription.organizationId, org.id));
      const lastEnd = Math.max(
        org.trialEndsAt?.getTime() ?? 0,
        ...subs.map((x) => (x.endedAt ?? x.cancelAt ?? x.currentPeriodEnd)?.getTime() ?? 0),
      );
      if (lastEnd > limit.getTime()) continue;
      await db.update(schema.organization).set({ deletedAt: now, updatedAt: now }).where(eq(schema.organization.id, org.id));
      await audit({ organizationId: org.id, actorType: "system", action: "retention.org_deleted", metadata: { rule: "contentAfterEndDays", days: r.contentAfterEndDays } });
      result.orgsDeleted++;
    }
  }

  if (r.deletedOrgPurgeDays !== null) {
    const orgs = await db
      .select()
      .from(schema.organization)
      .where(and(isNotNull(schema.organization.deletedAt), isNull(schema.organization.purgedAt), lt(schema.organization.deletedAt, before(r.deletedOrgPurgeDays))))
      .limit(50);
    for (const org of orgs) {
      const media = await db.select({ key: schema.mediaAsset.storageKey }).from(schema.mediaAsset).where(eq(schema.mediaAsset.organizationId, org.id));
      for (const m of media) await storage().delete(m.key).catch(() => undefined);
      await db.transaction(async (tx) => {
        await tx.update(schema.serviceOrder).set({ cardId: null }).where(eq(schema.serviceOrder.organizationId, org.id));
        await tx.delete(schema.card).where(eq(schema.card.organizationId, org.id)); // versions, statistiques, attributions en cascade
        await tx.delete(schema.mediaAsset).where(eq(schema.mediaAsset.organizationId, org.id));
        await tx.delete(schema.lead).where(eq(schema.lead.organizationId, org.id));
        await tx.delete(schema.analyticsDaily).where(eq(schema.analyticsDaily.organizationId, org.id));
        await tx.delete(schema.invitation).where(eq(schema.invitation.organizationId, org.id));
        await tx.delete(schema.membership).where(eq(schema.membership.organizationId, org.id));
        await tx.delete(schema.brandSettings).where(eq(schema.brandSettings.organizationId, org.id));
        await tx.delete(schema.serviceOrderMessage).where(eq(schema.serviceOrderMessage.organizationId, org.id));
        await tx.update(schema.organization).set({ purgedAt: now, updatedAt: now }).where(eq(schema.organization.id, org.id));
      });
      await audit({ organizationId: org.id, actorType: "system", action: "retention.org_purged", metadata: { files: media.length } });
      result.orgsPurged++;
    }
  }
  return result;
}

/**
 * Sauvegardes : lance une sauvegarde lorsqu'elle est due, applique la rétention, essaie
 * une restauration complète chaque semaine (si une base de test est configurée) et
 * alerte si aucune sauvegarde n'a réussi depuis trop longtemps.
 */
export async function backups(now = new Date()) {
  const { backupDestination } = await import("@/lib/backup/destination");
  const { isBackupDue, isBackupStale } = await import("@/lib/backup/policy");
  const svc = await import("@/lib/backup/service");
  const settings = (await getSettings()).backup;
  if (!backupDestination() || !settings.enabled) return { skipped: "désactivées ou sans destination" };
  const result: Record<string, unknown> = {};
  let last = await svc.lastSuccessfulBackup();
  if (isBackupDue(last?.startedAt ?? null, settings.frequencyHours, now)) {
    const run = await svc.runBackup({ trigger: "scheduled" }).catch((e: Error) => ({ status: "failed", error: e.message }) as const);
    result.backup = run.status;
    if (run.status === "ok") last = await svc.lastSuccessfulBackup();
  }
  result.retention = await svc.applyBackupRetention(now).catch((e: Error) => ({ error: e.message }));
  if (process.env.BACKUP_RESTORE_TEST_DATABASE_URL && last && (!last.restoreTestedAt || now.getTime() - last.restoreTestedAt.getTime() > 7 * 86400_000)) {
    const tested = await db
      .select({ at: schema.backupRun.restoreTestedAt })
      .from(schema.backupRun)
      .where(and(isNotNull(schema.backupRun.restoreTestedAt), gt(schema.backupRun.restoreTestedAt, new Date(now.getTime() - 7 * 86400_000))))
      .limit(1);
    if (!tested.length) result.restoreTest = (await svc.restoreTest(last.id)).ok ? "ok" : "failed";
  }
  if (isBackupStale(last?.startedAt ?? null, settings.frequencyHours, now)) {
    const to = settings.alertEmail || (await getSettings()).brand.supportEmail;
    if (to && !to.endsWith(".invalid")) {
      await sendEmail({
        to,
        template: "backupStale",
        email: templates.backupStale({ since: last ? formatDateTime(last.startedAt) : "la mise en service", url: `${appUrl()}/admin/sauvegardes` }),
        dedupeKey: `backup-stale:${now.toISOString().slice(0, 10)}`,
      });
      result.alert = "envoyée";
    }
  }
  return result;
}

export const JOBS = { trialNotifications, reconcileBilling, retryFailedEmails, rollupAnalytics, applyRetention, cleanup, backups } as const;

export async function runAllJobs(now = new Date()) {
  await getSettings(true);
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

