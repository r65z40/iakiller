import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { TIMEZONE } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Actor } from "@/lib/cards/service";

function today(): string {
  return new Date().toLocaleDateString("fr-CA", { timeZone: TIMEZONE });
}

/** Incrémente le compteur de vues d'un mini-site (agrégé par jour). Best-effort. */
export async function recordSiteView(siteId: string, organizationId: string): Promise<void> {
  try {
    await db
      .insert(schema.siteView)
      .values({ siteId, organizationId, day: today(), count: 1 })
      .onConflictDoUpdate({ target: [schema.siteView.siteId, schema.siteView.day], set: { count: sql`${schema.siteView.count} + 1` } });
  } catch {
    /* le suivi ne doit jamais bloquer l'affichage */
  }
}

/** Vues par mini-site sur les N derniers jours (réservé aux gestionnaires). */
export async function siteViewTotals(actor: Actor, days = 30): Promise<{ id: string; title: string; status: string; slug: string; views: number }[]> {
  if (!can(actor, "leads.viewAll")) return [];
  const since = new Date(Date.now() - days * 86400_000).toLocaleDateString("fr-CA", { timeZone: TIMEZONE });
  const rows = await db
    .select({
      id: schema.site.id,
      title: schema.site.title,
      status: schema.site.status,
      slug: schema.site.slug,
      views: sql<number>`coalesce(sum(case when ${schema.siteView.day} >= ${since} then ${schema.siteView.count} else 0 end), 0)::int`,
    })
    .from(schema.site)
    .leftJoin(schema.siteView, eq(schema.siteView.siteId, schema.site.id))
    .where(and(eq(schema.site.organizationId, actor.organization.id), sql`${schema.site.status} <> 'archived'`))
    .groupBy(schema.site.id)
    .orderBy(desc(sql`coalesce(sum(case when ${schema.siteView.day} >= ${since} then ${schema.siteView.count} else 0 end), 0)`));
  return rows;
}
