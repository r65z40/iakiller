import { settingsSync } from "@/lib/settings/store";

/**
 * Configuration centralisée. Les valeurs commerciales et légales sont modifiables dans
 * l'administration (/admin/reglages) et lues ici via le cache des réglages ; à défaut,
 * les variables d'environnement s'appliquent. Les champs vides affichent un repère
 * « à compléter » plutôt qu'une valeur inventée.
 */
const orTodo = (v: string, label: string) => v || `[${label} À COMPLÉTER]`;

export const brand = {
  get name() {
    return settingsSync().brand.name;
  },
  get tagline() {
    return settingsSync().brand.tagline;
  },
  get supportEmail() {
    return settingsSync().brand.supportEmail || "support@example.invalid";
  },
  legal: {
    get companyName() { return orTodo(settingsSync().company.companyName, "RAISON SOCIALE"); },
    get legalForm() { return orTodo(settingsSync().company.legalForm, "FORME JURIDIQUE"); },
    get capital() { return orTodo(settingsSync().company.capital, "CAPITAL SOCIAL"); },
    get address() { return orTodo(settingsSync().company.address, "ADRESSE DU SIÈGE"); },
    get siren() { return orTodo(settingsSync().company.siren, "SIREN / RCS"); },
    get vat() { return orTodo(settingsSync().company.vat, "N° TVA INTRACOMMUNAUTAIRE"); },
    get director() { return orTodo(settingsSync().company.director, "DIRECTEUR DE LA PUBLICATION"); },
    get host() { return orTodo(settingsSync().company.host, "HÉBERGEUR : NOM, ADRESSE, TÉLÉPHONE"); },
    get contactEmail() { return orTodo(settingsSync().company.contactEmail, "EMAIL DE CONTACT"); },
  },
};

/** URL technique fixée par l'environnement (authentification, cookies). */
export function envAppUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** URL publique : domaine réglé dans l'administration, sinon APP_URL. */
export function appUrl(): string {
  return (settingsSync().brand.publicUrl || envAppUrl()).replace(/\/$/, "");
}

export { TIMEZONE } from "@/lib/format";

/** Règles d'essai (propositions à valider, voir DECISIONS.md). */
export const trialRules = {
  durationHours: 7 * 24,
  cardQuota: 3,
  storageQuotaMb: 100,
  memberQuota: 3,
};

/** Délai de grâce en cas d'impayé, réglable dans l'administration (défaut : BILLING_GRACE_DAYS ou 7). */
export function graceDays(): number {
  return settingsSync().billing.graceDays;
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
