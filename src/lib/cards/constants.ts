/**
 * Constantes des cartes, SANS dépendance : importables par les composants navigateur
 * (affichage public, éditeur) sans embarquer la bibliothèque de validation.
 * Le schéma de validation (Zod) vit dans ./document.ts, réservé au serveur.
 */
export const CURRENT_SCHEMA_VERSION = 1;

export const TEMPLATES = ["classique", "portrait", "entreprise"] as const;
export type TemplateId = (typeof TEMPLATES)[number];

export const FONTS = {
  inter: { label: "Inter (sans empattement)", css: "'Inter Variable', system-ui, sans-serif" },
  source: { label: "Source Serif (avec empattement)", css: "'Source Serif 4 Variable', Georgia, serif" },
  manrope: { label: "Manrope (arrondie)", css: "'Manrope Variable', system-ui, sans-serif" },
  system: { label: "Police du système", css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
} as const;
export type FontId = keyof typeof FONTS;

export const CONTACT_KINDS = ["mobile", "landline", "email", "whatsapp", "sms", "address", "website"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const SOCIAL_NETWORKS = ["linkedin", "instagram", "facebook", "x", "youtube", "tiktok", "other"] as const;
export const LINK_ICONS = ["web", "linkedin", "instagram", "facebook", "calendar", "document", "shop", "star", "link"] as const;
