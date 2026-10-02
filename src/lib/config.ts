/**
 * Configuration centralisée. Le nom de marque est provisoire et se change ici
 * (ou via la variable NEXT_PUBLIC_BRAND_NAME) sans toucher au reste du code.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Carto",
  tagline: "Cartes de visite numériques pour les professionnels",
  supportEmail: process.env.SUPPORT_EMAIL || "support@example.invalid",
  /** Informations légales de l'exploitant : à compléter avant la production (voir DECISIONS.md). */
  legal: {
    companyName: process.env.LEGAL_COMPANY_NAME || "[RAISON SOCIALE À COMPLÉTER]",
    legalForm: process.env.LEGAL_FORM || "[FORME JURIDIQUE À COMPLÉTER]",
    capital: process.env.LEGAL_CAPITAL || "[CAPITAL SOCIAL À COMPLÉTER]",
    address: process.env.LEGAL_ADDRESS || "[ADRESSE DU SIÈGE À COMPLÉTER]",
    siren: process.env.LEGAL_SIREN || "[SIREN / RCS À COMPLÉTER]",
    vat: process.env.LEGAL_VAT || "[N° TVA INTRACOMMUNAUTAIRE À COMPLÉTER]",
    director: process.env.LEGAL_DIRECTOR || "[DIRECTEUR DE LA PUBLICATION À COMPLÉTER]",
    host: process.env.LEGAL_HOST || "[HÉBERGEUR : NOM, ADRESSE, TÉLÉPHONE À COMPLÉTER]",
    contactEmail: process.env.LEGAL_CONTACT_EMAIL || "[EMAIL DE CONTACT À COMPLÉTER]",
  },
};

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export const TIMEZONE = "Europe/Paris";

/** Règles d'essai (propositions à valider, voir DECISIONS.md). */
export const trialRules = {
  durationHours: 7 * 24,
  cardQuota: 3,
  storageQuotaMb: 100,
  memberQuota: 3,
};

/** Délai de grâce en cas d'impayé, configurable. Proposition : 7 jours. */
export function graceDays(): number {
  const v = Number(process.env.BILLING_GRACE_DAYS ?? "7");
  return Number.isFinite(v) && v >= 0 ? v : 7;
}

export const limits = {
  imageMaxBytes: 8 * 1024 * 1024,
  imageMaxPixels: 40_000_000,
  imageMaxDimension: 8000,
  pdfMaxBytes: 15 * 1024 * 1024,
  maxCardsPerPage: 50,
};

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
