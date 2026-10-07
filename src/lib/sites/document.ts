import { z } from "zod";
import {
  bannerSchema,
  blockSchema,
  collectMediaIds,
  identitySchema,
  publicDocument,
  publishProblems,
  themeSchema,
  type CardBlock,
  type CardDocument,
} from "@/lib/cards/document";
import { CURRENT_SCHEMA_VERSION } from "@/lib/cards/constants";

/**
 * Un mini-site réutilise entièrement le modèle de carte : thème, identité et bannière
 * sont PARTAGÉS par toutes les pages (pas de double saisie), et chaque page contient
 * des blocs du même type que les cartes. Une page composée (thème + identité + bannière
 * + blocs de la page) est un `CardDocument` valide : tout le rendu et la validation des
 * blocs sont donc réutilisés tels quels.
 */

/** Clés de page proposées par défaut (une page « libre » reste possible). */
export const PAGE_KEYS = ["accueil", "services", "realisations", "contact", "page"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

const pageSlug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Adresse de page invalide")
  .max(40);

export const sitePageSchema = z.object({
  id: z.string().min(1).max(30),
  key: z.enum(PAGE_KEYS),
  label: z.string().min(1).max(40),
  slug: pageSlug,
  blocks: z.array(blockSchema).max(40),
});
export type SitePage = z.infer<typeof sitePageSchema>;

export const siteDocumentSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    theme: themeSchema,
    identity: identitySchema,
    banner: bannerSchema,
    pages: z.array(sitePageSchema).min(1).max(8),
  })
  .superRefine((doc, ctx) => {
    const pageIds = new Set<string>();
    const slugs = new Set<string>();
    doc.pages.forEach((p, i) => {
      if (pageIds.has(p.id)) ctx.addIssue({ code: "custom", path: ["pages", i, "id"], message: "Identifiant de page dupliqué" });
      pageIds.add(p.id);
      if (slugs.has(p.slug)) ctx.addIssue({ code: "custom", path: ["pages", i, "slug"], message: "Deux pages ont la même adresse" });
      slugs.add(p.slug);

      const blockIds = new Set<string>();
      p.blocks.forEach((b, j) => {
        if (blockIds.has(b.id)) ctx.addIssue({ code: "custom", path: ["pages", i, "blocks", j, "id"], message: "Identifiant de bloc dupliqué" });
        blockIds.add(b.id);
      });
      if (p.blocks.filter((b) => b.type === "leadForm").length > 1) ctx.addIssue({ code: "custom", path: ["pages", i, "blocks"], message: "Un seul formulaire de contact par page" });
      if (p.blocks.filter((b) => b.type === "map").length > 1) ctx.addIssue({ code: "custom", path: ["pages", i, "blocks"], message: "Un seul bloc « Zone d'intervention » par page" });
    });
  });

export type SiteDocument = z.infer<typeof siteDocumentSchema>;

export function parseSiteDocument(raw: unknown) {
  return siteDocumentSchema.safeParse(raw);
}

/** Compose le `CardDocument` d'une page (thème/identité/bannière partagés + blocs de la page). */
export function pageDocument(site: SiteDocument, page: SitePage): CardDocument {
  return { schemaVersion: site.schemaVersion, theme: site.theme, identity: site.identity, banner: site.banner, blocks: page.blocks };
}

/** Projection publique : applique la projection carte (blocs masqués, photo/logo masqués) à chaque page. */
export function publicSiteDocument(site: SiteDocument): SiteDocument {
  const base = publicDocument(pageDocument(site, site.pages[0]));
  return {
    schemaVersion: site.schemaVersion,
    theme: site.theme,
    identity: base.identity,
    banner: base.banner,
    pages: site.pages.map((p) => ({ ...p, blocks: publicDocument(pageDocument(site, p)).blocks as CardBlock[] })),
  };
}

/** Tous les médias référencés par un mini-site (pour l'accès public, comme pour une carte). */
export function collectSiteMediaIds(site: SiteDocument): string[] {
  const ids = new Set<string>();
  for (const p of site.pages) for (const id of collectMediaIds(pageDocument(site, p))) ids.add(id);
  return [...ids];
}

/** Problèmes bloquant la publication (préfixés par le nom de la page concernée). */
export function siteProblems(site: SiteDocument): string[] {
  const problems: string[] = [];
  if (!site.identity.firstName && !site.identity.lastName && !site.identity.company) {
    problems.push("Renseignez au moins un nom ou une société (identité du site).");
  }
  for (const p of site.pages) for (const m of publishProblems(pageDocument(site, p))) problems.push(`${p.label} : ${m}`);
  return [...new Set(problems)];
}
