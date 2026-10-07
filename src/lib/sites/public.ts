import { cache } from "react";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { loadEntitlement } from "@/lib/billing/load";
import { parseSiteDocument, publicSiteDocument, type SiteDocument } from "./document";

export type PublicSiteResult =
  | { kind: "ok"; organization: typeof schema.organization.$inferSelect; site: typeof schema.site.$inferSelect; document: SiteDocument; versionId: string }
  | { kind: "unavailable" }
  | { kind: "not_found" };

/** Mêmes conditions d'accès qu'une carte : publié, non désactivé/suspendu, droits actifs. */
export async function isSitePubliclyAccessible(site: typeof schema.site.$inferSelect, now = new Date()) {
  if (site.status !== "published" || !site.publishedVersionId) return false;
  if (site.disabledAt || site.adminSuspendedAt) return false;
  const ent = await loadEntitlement(site.organizationId, db, now);
  // Les mini-sites font partie de la Suite acquisition (Pro et +) : hors essai/Pro, le site n'est plus servi.
  return ent.publicAccess && ent.marketingSuite;
}

async function loadAccessible(org: typeof schema.organization.$inferSelect, site: typeof schema.site.$inferSelect): Promise<PublicSiteResult> {
  if (org.deletedAt) return { kind: "not_found" };
  if (!(await isSitePubliclyAccessible(site))) return { kind: "unavailable" };
  const [version] = await db
    .select()
    .from(schema.siteVersion)
    .where(and(eq(schema.siteVersion.id, site.publishedVersionId!), eq(schema.siteVersion.siteId, site.id)));
  if (!version) return { kind: "unavailable" };
  const parsed = parseSiteDocument(version.document);
  if (!parsed.success) return { kind: "unavailable" };
  return { kind: "ok", organization: org, site, document: publicSiteDocument(parsed.data), versionId: version.id };
}

export async function resolvePublicSite(orgSlug: string, siteSlug: string): Promise<PublicSiteResult> {
  const [org] = await db.select().from(schema.organization).where(and(eq(schema.organization.slug, orgSlug), isNull(schema.organization.deletedAt)));
  if (!org) return { kind: "not_found" };
  const [row] = await db.select().from(schema.site).where(and(eq(schema.site.organizationId, org.id), eq(schema.site.slug, siteSlug)));
  if (!row) return { kind: "not_found" };
  return loadAccessible(org, row);
}

export const resolvePublicSiteForRequest = cache(resolvePublicSite);
