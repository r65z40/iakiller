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
  /** Clé de stockage de la vidéo d'accueil (vide = aucune). Servie via /video-accueil. */
  get promoVideoKey() {
    return settingsSync().brand.promoVideoKey;
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

export interface PromoBanner {
  message: string;
  ctaLabel: string;
  ctaHref: string;
  tone: "brand" | "dark" | "success" | "warning";
  dismissible: boolean;
  /** Clé de version : change avec le message, pour ré-afficher une bannière masquée après modification. */
  key: string;
}

/** Bannière promotionnelle active (activée, non vide, dans la fenêtre de dates), sinon null. */
export function promoBanner(now = new Date()): PromoBanner | null {
  const p = settingsSync().promo;
  if (!p.enabled || !p.message.trim()) return null;
  const today = now.toISOString().slice(0, 10);
  if (p.startsAt && today < p.startsAt) return null;
  if (p.endsAt && today > p.endsAt) return null;
  const key = Buffer.from(`${p.message}|${p.ctaLabel}|${p.ctaHref}`).toString("base64").slice(0, 24);
  return { message: p.message, ctaLabel: p.ctaLabel, ctaHref: p.ctaHref, tone: p.tone, dismissible: p.dismissible, key };
}

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
  /** Vidéo de présentation (page d'accueil) : 50 Mo pour garder un chargement raisonnable. */
  videoMaxBytes: 50 * 1024 * 1024,
  maxCardsPerPage: 50,
};

/** Types vidéo acceptés pour la vidéo d'accueil (lecture large sur navigateurs). */
export const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };

