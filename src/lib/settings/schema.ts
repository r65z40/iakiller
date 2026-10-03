import { z } from "zod";

/**
 * Réglages de la plateforme, modifiables dans /admin/reglages.
 * Fichier pur (sans accès base) : utilisable par les formulaires et les tests.
 * Chaque valeur absente retombe sur la variable d'environnement correspondante, puis sur
 * une valeur par défaut ; aucune valeur juridique ou commerciale n'est inventée.
 */

const text = (max: number) => z.string().trim().max(max);
const nullableDays = z.number().int().min(1).max(36500).nullable();

const validation = z.object({
  validated: z.boolean(),
  validatedBy: text(120),
  validatedAt: z.string().max(40).nullable(),
});
export type Validation = z.infer<typeof validation>;

export const LEGAL_PAGES = {
  mentions: "Mentions légales",
  confidentialite: "Politique de confidentialité",
  conditions: "Conditions du service",
  cookies: "Cookies et mesure d'audience",
  sousTraitance: "Accord de sous-traitance (DPA)",
} as const;
export type LegalPageKey = keyof typeof LEGAL_PAGES;

const legalPage = validation.extend({
  /** Texte rédigé ou validé par un professionnel ; s'il est renseigné, il remplace le modèle. */
  customText: text(30000),
});

export const settingsSchema = z.object({
  brand: z.object({
    name: text(60).min(1, "Nom de marque obligatoire"),
    tagline: text(160),
    /** Adresse publique canonique, ex. https://cartes.exemple.fr */
    publicUrl: text(200).refine((v) => v === "" || /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(v), "Adresse attendue sous la forme https://domaine.fr (sans chemin)"),
    supportEmail: text(254),
    emailFrom: text(254),
  }),
  company: z.object({
    companyName: text(160),
    legalForm: text(80),
    capital: text(80),
    address: text(300),
    siren: text(80),
    vat: text(40),
    director: text(160),
    host: text(400),
    contactEmail: text(254),
    dpo: text(200),
  }),
  billing: z.object({
    graceDays: z.number().int().min(0).max(60),
    /** Remise annuelle de référence (%), utilisée pour proposer le prix annuel à partir du mensuel. */
    annualDiscountPercent: z.number().min(0).max(90),
    taxNote: text(300),
  }),
  retention: z.object({
    /** Suppression (logique) des organisations restées sans droit actif pendant N jours. null = jamais. */
    contentAfterEndDays: nullableDays,
    /** Purge définitive des organisations supprimées après N jours. null = jamais. */
    deletedOrgPurgeDays: nullableDays,
    leadsDays: nullableDays,
    auditDays: nullableDays,
    analyticsRawDays: z.number().int().min(30).max(3650),
    /** Pièces comptables : information affichée, aucune purge automatique. */
    accountingYears: z.number().int().min(1).max(30).nullable(),
  }),
  service: z.object({
    /** Conditions de la création accompagnée, affichées publiquement une fois publiées. */
    conditions: text(10000),
    deliveryDelay: text(300),
    revisionsPolicy: text(1000),
    refundPolicy: text(2000),
    published: z.boolean(),
  }),
  legal: z.object({
    mentions: legalPage,
    confidentialite: legalPage,
    conditions: legalPage,
    cookies: legalPage,
    sousTraitance: legalPage,
  }),
  analytics: validation.extend({
    mode: z.enum(["minimal", "consent", "off"]),
    note: text(2000),
  }),
});

export type PlatformSettings = z.infer<typeof settingsSchema>;
export type SettingsSection = keyof PlatformSettings;

const env = (k: string) => process.env[k]?.trim() || "";
const emptyValidation: Validation = { validated: false, validatedBy: "", validatedAt: null };
const emptyLegal = { ...emptyValidation, customText: "" };

export function defaultSettings(): PlatformSettings {
  const grace = Number(process.env.BILLING_GRACE_DAYS ?? "7");
  const raw = Number(process.env.ANALYTICS_RAW_RETENTION_DAYS ?? "395");
  return {
    brand: {
      name: env("NEXT_PUBLIC_BRAND_NAME") || "Carto",
      tagline: "Cartes de visite numériques pour les professionnels",
      publicUrl: "",
      supportEmail: env("SUPPORT_EMAIL") || "support@example.invalid",
      emailFrom: env("EMAIL_FROM"),
    },
    company: {
      companyName: env("LEGAL_COMPANY_NAME"),
      legalForm: env("LEGAL_FORM"),
      capital: env("LEGAL_CAPITAL"),
      address: env("LEGAL_ADDRESS"),
      siren: env("LEGAL_SIREN"),
      vat: env("LEGAL_VAT"),
      director: env("LEGAL_DIRECTOR"),
      host: env("LEGAL_HOST"),
      contactEmail: env("LEGAL_CONTACT_EMAIL"),
      dpo: "",
    },
    billing: { graceDays: Number.isFinite(grace) && grace >= 0 ? grace : 7, annualDiscountPercent: 0, taxNote: "" },
    retention: {
      contentAfterEndDays: null,
      deletedOrgPurgeDays: null,
      leadsDays: null,
      auditDays: null,
      analyticsRawDays: Number.isFinite(raw) && raw >= 30 ? raw : 395,
      accountingYears: null,
    },
    service: { conditions: "", deliveryDelay: "", revisionsPolicy: "", refundPolicy: "", published: false },
    legal: { mentions: emptyLegal, confidentialite: emptyLegal, conditions: emptyLegal, cookies: emptyLegal, sousTraitance: emptyLegal },
    analytics: {
      ...emptyValidation,
      mode: process.env.ANALYTICS_MODE === "off" ? "off" : process.env.ANALYTICS_REQUIRE_CONSENT === "true" ? "consent" : "minimal",
      note: "",
    },
  };
}

/** Fusionne une valeur stockée (éventuellement ancienne ou partielle) avec les valeurs par défaut. */
export function mergeSettings(stored: unknown): PlatformSettings {
  const base = defaultSettings();
  if (!stored || typeof stored !== "object") return base;
  const s = stored as Record<string, Record<string, unknown>>;
  const merged = {
    brand: { ...base.brand, ...(s.brand ?? {}) },
    company: { ...base.company, ...(s.company ?? {}) },
    billing: { ...base.billing, ...(s.billing ?? {}) },
    retention: { ...base.retention, ...(s.retention ?? {}) },
    service: { ...base.service, ...(s.service ?? {}) },
    legal: Object.fromEntries(
      (Object.keys(base.legal) as LegalPageKey[]).map((k) => [k, { ...base.legal[k], ...((s.legal?.[k] as object) ?? {}) }]),
    ),
    analytics: { ...base.analytics, ...(s.analytics ?? {}) },
  };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : base;
}

/** Champs de la société manquants (bloquants pour le lancement). */
export function missingCompanyFields(s: PlatformSettings): string[] {
  const labels: Record<string, string> = {
    companyName: "raison sociale", legalForm: "forme juridique", capital: "capital", address: "siège social",
    siren: "SIREN / RCS", vat: "TVA intracommunautaire", director: "directeur de la publication", host: "hébergeur", contactEmail: "email de contact",
  };
  return Object.entries(labels).filter(([k]) => !s.company[k as keyof PlatformSettings["company"]]).map(([, l]) => l);
}
