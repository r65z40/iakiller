/**
 * Slugs publics : /{entreprise}/{personne}.
 * Les préfixes techniques sont réservés pour éviter toute collision avec les routes de l'application.
 */
export const RESERVED_ORG_SLUGS = new Set([
  "admin", "app", "api", "connexion", "inscription", "deconnexion", "tarifs", "r", "m", "_next",
  "static", "public", "assets", "media", "medias", "fonctionnement", "modeles", "entreprise", "entreprises",
  "creation-accompagnee", "faq", "contact", "mentions-legales", "confidentialite", "conditions", "cgu", "cgv",
  "cookies", "indisponible", "invitation", "verification-email", "mot-de-passe-oublie", "reinitialiser-mot-de-passe",
  "dev", "aide", "support", "blog", "status", "statut", "robots.txt", "sitemap.xml", "favicon.ico", "www",
  "mail", "email", "compte", "parametres", "facturation", "legal", "sous-traitance", "dpa", "securite", "login",
  "signup", "logout", "auth", "oauth", "webhook", "webhooks", "stripe", "health", "sante", "a-propos", "presse",
]);

export const RESERVED_CARD_SLUGS = new Set(["vcard", "qr", "contact", "api", "edit", "admin"]);

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export function validateOrgSlug(slug: string): string | null {
  if (!SLUG_RE.test(slug) || slug.length < 2) return "L'adresse doit contenir 2 à 48 caractères : lettres minuscules, chiffres et tirets.";
  if (RESERVED_ORG_SLUGS.has(slug)) return "Cette adresse est réservée.";
  return null;
}

export function validateCardSlug(slug: string): string | null {
  if (!SLUG_RE.test(slug) || slug.length < 1) return "L'adresse doit contenir 1 à 48 caractères : lettres minuscules, chiffres et tirets.";
  if (RESERVED_CARD_SLUGS.has(slug)) return "Cette adresse est réservée.";
  return null;
}
