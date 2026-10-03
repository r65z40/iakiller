import { and, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { Actor } from "@/lib/cards/service";
import { ACTION_TYPES } from "./service";

/**
 * Requêtes du tableau de bord. Toutes les requêtes sont bornées à l'organisation de
 * l'acteur, et aux cartes assignées pour un collaborateur.
 *
 * Définitions (voir docs/STATISTIQUES.md) :
 * - Ouvertures mesurées : affichages de carte ayant exécuté la mesure (JavaScript actif,
 *   consentement obtenu si requis), hors robots détectés et visites internes.
 * - Taux de clic = ouvertures mesurées ayant au moins une action / ouvertures mesurées.
 * - Taux de formulaire = formulaires envoyés / ouvertures mesurées.
 * Aucun « visiteur unique » n'est calculé : aucun identifiant persistant n'est collecté.
 */

export interface StatsFilter {
  from: Date; // inclus
  to: Date; // exclu
  cardId?: string | null;
  memberUserId?: string | null;
  includeInternal?: boolean;
}

async function scopedCardIds(actor: Actor, filter: StatsFilter): Promise<string[] | null> {
  let ids: string[] | null = null;
  if (!can(actor, "analytics.viewAll")) {
    const rows = await db.select({ id: schema.cardAssignment.cardId }).from(schema.cardAssignment).where(and(eq(schema.cardAssignment.userId, actor.user.id), eq(schema.cardAssignment.organizationId, actor.organization.id)));
    ids = rows.map((r) => r.id);
  }
  if (filter.memberUserId) {
    const rows = await db.select({ id: schema.cardAssignment.cardId }).from(schema.cardAssignment).where(and(eq(schema.cardAssignment.userId, filter.memberUserId), eq(schema.cardAssignment.organizationId, actor.organization.id)));
    const m = rows.map((r) => r.id);
    ids = ids ? ids.filter((i) => m.includes(i)) : m;
  }
  if (filter.cardId) ids = ids ? ids.filter((i) => i === filter.cardId) : [filter.cardId];
  return ids;
}

async function baseWhere(actor: Actor, filter: StatsFilter): Promise<SQL | null> {
  const ids = await scopedCardIds(actor, filter);
  if (ids && ids.length === 0) return null;
  const conds: SQL[] = [
    eq(schema.analyticsEvent.organizationId, actor.organization.id),
    gte(schema.analyticsEvent.occurredAt, filter.from),
    lt(schema.analyticsEvent.occurredAt, filter.to),
    eq(schema.analyticsEvent.isBot, false),
  ];
  if (!filter.includeInternal) conds.push(eq(schema.analyticsEvent.isInternal, false));
  if (ids) conds.push(inArray(schema.analyticsEvent.cardId, ids));
  return and(...conds)!;
}

const parisDay = sql<string>`to_char(${schema.analyticsEvent.occurredAt} at time zone 'Europe/Paris', 'YYYY-MM-DD')`;

export async function totals(actor: Actor, filter: StatsFilter) {
  const where = await baseWhere(actor, filter);
  if (!where) return { views: 0, actionViews: 0, leads: 0, clickRate: null as number | null, formRate: null as number | null };
  const actionList = sql.join(ACTION_TYPES.map((t) => sql`${t}`), sql`, `);
  const [r] = await db
    .select({
      views: sql<number>`count(*) filter (where ${schema.analyticsEvent.type} = 'view')::int`,
      actionViews: sql<number>`count(distinct ${schema.analyticsEvent.viewId}) filter (where ${schema.analyticsEvent.type} in (${actionList}))::int`,
      leads: sql<number>`count(*) filter (where ${schema.analyticsEvent.type} = 'lead_submit')::int`,
    })
    .from(schema.analyticsEvent)
    .where(where);
  const views = r?.views ?? 0;
  return {
    views,
    actionViews: r?.actionViews ?? 0,
    leads: r?.leads ?? 0,
    clickRate: views > 0 ? (r!.actionViews / views) : null,
    formRate: views > 0 ? (r!.leads / views) : null,
  };
}

export async function dailySeries(actor: Actor, filter: StatsFilter) {
  const where = await baseWhere(actor, filter);
  if (!where) return [];
  const actionList = sql.join(ACTION_TYPES.map((t) => sql`${t}`), sql`, `);
  return db
    .select({
      day: parisDay,
      views: sql<number>`count(*) filter (where ${schema.analyticsEvent.type} = 'view')::int`,
      actions: sql<number>`count(*) filter (where ${schema.analyticsEvent.type} in (${actionList}))::int`,
    })
    .from(schema.analyticsEvent)
    .where(where)
    .groupBy(parisDay)
    .orderBy(parisDay);
}

export async function breakdown(actor: Actor, filter: StatsFilter, dimension: "type" | "source" | "device" | "browser" | "country" | "utmCampaign") {
  const where = await baseWhere(actor, filter);
  if (!where) return [];
  const col = schema.analyticsEvent[dimension];
  const conds = dimension === "type" ? where : and(where, eq(schema.analyticsEvent.type, "view"));
  return db
    .select({ key: sql<string>`coalesce(${col}, '—')`, count: sql<number>`count(*)::int` })
    .from(schema.analyticsEvent)
    .where(conds)
    .groupBy(col)
    .orderBy(sql`count(*) desc`)
    .limit(30);
}

export async function topCards(actor: Actor, filter: StatsFilter) {
  const where = await baseWhere(actor, filter);
  if (!where) return [];
  const actionList = sql.join(ACTION_TYPES.map((t) => sql`${t}`), sql`, `);
  return db
    .select({
      cardId: schema.analyticsEvent.cardId,
      title: schema.card.title,
      views: sql<number>`count(*) filter (where ${schema.analyticsEvent.type} = 'view')::int`,
      actionViews: sql<number>`count(distinct ${schema.analyticsEvent.viewId}) filter (where ${schema.analyticsEvent.type} in (${actionList}))::int`,
      leads: sql<number>`count(*) filter (where ${schema.analyticsEvent.type} = 'lead_submit')::int`,
    })
    .from(schema.analyticsEvent)
    .innerJoin(schema.card, eq(schema.card.id, schema.analyticsEvent.cardId))
    .where(where)
    .groupBy(schema.analyticsEvent.cardId, schema.card.title)
    .orderBy(sql`count(*) filter (where ${schema.analyticsEvent.type} = 'view') desc`)
    .limit(20);
}

/** Export CSV : agrégats journaliers par carte et type d'événement. */
export async function exportRows(actor: Actor, filter: StatsFilter) {
  const where = await baseWhere(actor, filter);
  if (!where) return [];
  return db
    .select({ day: parisDay, card: schema.card.title, type: schema.analyticsEvent.type, source: schema.analyticsEvent.source, count: sql<number>`count(*)::int` })
    .from(schema.analyticsEvent)
    .innerJoin(schema.card, eq(schema.card.id, schema.analyticsEvent.cardId))
    .where(where)
    .groupBy(parisDay, schema.card.title, schema.analyticsEvent.type, schema.analyticsEvent.source)
    .orderBy(parisDay)
    .limit(50000);
}

