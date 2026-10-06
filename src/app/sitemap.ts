import type { MetadataRoute } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { appUrl } from "@/lib/config";
import { db, schema } from "@/lib/db";

/**
 * Plan du site : pages commerciales + mini-sites publics indexables.
 * Les cartes ne sont volontairement pas listées (aucun annuaire public des cartes).
 * Les mini-sites, eux, sont de vrais sites vitrines : ceux dont l'organisation autorise
 * l'indexation et qui sont publiés sont inclus.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const now = new Date();
  const pages: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "", priority: 1, freq: "weekly" },
    { path: "/fonctionnement", priority: 0.8, freq: "monthly" },
    { path: "/modeles", priority: 0.8, freq: "monthly" },
    { path: "/tarifs", priority: 0.9, freq: "weekly" },
    { path: "/entreprise", priority: 0.7, freq: "monthly" },
    { path: "/creation-accompagnee", priority: 0.7, freq: "monthly" },
    { path: "/faq", priority: 0.6, freq: "monthly" },
    { path: "/contact", priority: 0.5, freq: "yearly" },
  ];
  const entries: MetadataRoute.Sitemap = pages.map((p) => ({ url: `${base}${p.path}`, lastModified: now, changeFrequency: p.freq, priority: p.priority }));

  try {
    const sites = await db
      .select({ orgSlug: schema.organization.slug, slug: schema.site.slug, updatedAt: schema.site.updatedAt })
      .from(schema.site)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.site.organizationId))
      .where(
        and(
          eq(schema.site.status, "published"),
          isNull(schema.site.disabledAt),
          isNull(schema.site.adminSuspendedAt),
          isNull(schema.organization.deletedAt),
          eq(schema.organization.allowIndexing, true),
        ),
      )
      .limit(5000);
    for (const s of sites) {
      entries.push({ url: `${base}/s/${s.orgSlug}/${s.slug}`, lastModified: s.updatedAt ?? now, changeFrequency: "weekly", priority: 0.6 });
    }
  } catch {
    // Le plan du site reste valable même si la base est momentanément indisponible.
  }
  return entries;
}
