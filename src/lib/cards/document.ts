import { z } from "zod";
import { isHexColor, normalizePhone, normalizeWebUrl, isValidEmail } from "@/lib/validation/urls";

/**
 * Document de carte, versionné (schemaVersion). Le même document est rendu par tous
 * les modèles : un modèle ne change que la présentation, jamais les données.
 * Toute évolution du format doit incrémenter CURRENT_SCHEMA_VERSION et fournir une
 * migration dans migrateDocument().
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

const id = z.string().regex(/^[A-Za-z0-9_-]{4,40}$/);
const mediaId = id.nullable();
const short = (max = 80) => z.string().trim().max(max);
const color = z.string().refine(isHexColor, "Couleur hexadécimale attendue (#RRGGBB)");

const webUrl = z
  .string()
  .trim()
  .max(2048)
  .transform((v, ctx) => {
    const n = normalizeWebUrl(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Adresse web invalide (http ou https uniquement)" });
      return z.NEVER;
    }
    return n;
  });

/** URL facultative : chaîne vide acceptée pendant la rédaction du brouillon. */
const optionalWebUrl = z.union([z.literal(""), webUrl]);

export const themeSchema = z.object({
  template: z.enum(TEMPLATES),
  font: z.enum(Object.keys(FONTS) as [FontId, ...FontId[]]),
  primaryColor: color,
  pageBackground: color,
  cardBackground: color,
  textColor: color,
  mutedColor: color,
  buttonTextColor: color,
  /** Rayon des coins en px, borné. */
  radius: z.number().int().min(0).max(28),
  buttonStyle: z.enum(["soft", "filled", "outline"]),
  align: z.enum(["center", "left"]),
  spacing: z.enum(["compact", "normal", "airy"]),
  borderWidth: z.number().int().min(0).max(2),
  nameSize: z.enum(["sm", "md", "lg"]),
});
export type CardTheme = z.infer<typeof themeSchema>;

export const identitySchema = z.object({
  firstName: short(60),
  lastName: short(60),
  jobTitle: short(80),
  company: short(80),
  photoMediaId: mediaId,
  logoMediaId: mediaId,
  showPhoto: z.boolean(),
  showLogo: z.boolean(),
});
export type CardIdentity = z.infer<typeof identitySchema>;

export const bannerSchema = z.object({
  mediaId: mediaId,
  focalX: z.number().min(0).max(100),
  focalY: z.number().min(0).max(100),
  height: z.number().int().min(80).max(240),
  blur: z.number().min(0).max(12),
  veilOpacity: z.number().int().min(0).max(90),
});
export type CardBanner = z.infer<typeof bannerSchema>;

export const CONTACT_KINDS = ["mobile", "landline", "email", "whatsapp", "sms", "address", "website"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

const contactItem = z
  .object({ id, kind: z.enum(CONTACT_KINDS), label: short(80), value: short(300) })
  .superRefine((item, ctx) => {
    if (!item.value) return; // champ vide toléré en brouillon, ignoré au rendu
    const ok =
      item.kind === "email"
        ? isValidEmail(item.value)
        : item.kind === "website"
          ? normalizeWebUrl(item.value) !== null
          : item.kind === "address"
            ? true
            : normalizePhone(item.value) !== null;
    if (!ok) ctx.addIssue({ code: "custom", path: ["value"], message: "Valeur invalide pour ce type de contact" });
  });

export const SOCIAL_NETWORKS = ["linkedin", "instagram", "facebook", "x", "youtube", "tiktok", "other"] as const;
export const LINK_ICONS = ["web", "linkedin", "instagram", "facebook", "calendar", "document", "shop", "star", "link"] as const;

const fieldMode = z.enum(["off", "optional", "required"]);

const blockBase = { id, hidden: z.boolean() };

export const blockSchema = z.discriminatedUnion("type", [
  z.object({
    ...blockBase,
    type: z.literal("actions"),
    showCall: z.boolean(),
    showEmail: z.boolean(),
    showVcard: z.boolean(),
    /** Boutons Apple / Google Wallet (affichés seulement si la plateforme les a configurés). */
    showWallet: z.boolean().default(true),
    callLabel: short(40),
    emailLabel: short(40),
    vcardLabel: short(40),
  }),
  z.object({ ...blockBase, type: z.literal("contacts"), title: short(60), items: z.array(contactItem).max(20) }),
  z.object({
    ...blockBase,
    type: z.literal("about"),
    title: short(60),
    /** Texte riche limité : paragraphes, **gras**, *italique*, listes "- ". Jamais de HTML. */
    text: z.string().max(2000),
    tags: z.array(short(40)).max(20),
  }),
  z.object({
    ...blockBase,
    type: z.literal("links"),
    title: short(60),
    items: z
      .array(z.object({ id, title: short(60), subtitle: short(100), url: optionalWebUrl, icon: z.enum(LINK_ICONS) }))
      .max(20),
  }),
  z.object({
    ...blockBase,
    type: z.literal("social"),
    title: short(60),
    items: z.array(z.object({ id, network: z.enum(SOCIAL_NETWORKS), label: short(60), url: optionalWebUrl })).max(12),
  }),
  z.object({
    ...blockBase,
    type: z.literal("gallery"),
    title: short(60),
    items: z.array(z.object({ id, mediaId: z.union([z.literal(""), id]), caption: short(120) })).max(24),
  }),
  z.object({
    ...blockBase,
    type: z.literal("video"),
    title: short(60),
    provider: z.enum(["youtube", "vimeo"]).nullable(),
    videoId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{0,20}$/)
      .max(20),
  }),
  z.object({
    ...blockBase,
    type: z.literal("documents"),
    title: short(60),
    items: z.array(z.object({ id, mediaId: z.union([z.literal(""), id]), title: short(100) })).max(12),
  }),
  z.object({
    ...blockBase,
    type: z.literal("appointment"),
    title: short(60),
    label: short(60),
    url: optionalWebUrl,
    note: short(200),
  }),
  z.object({
    ...blockBase,
    type: z.literal("reviews"),
    title: short(60),
    /** Plateforme d'avis ; aucun texte d'avis ni note n'est saisi dans la carte (pas de faux avis). */
    platform: z.enum(["google", "other"]),
    platformName: short(40),
    readUrl: optionalWebUrl,
    writeUrl: optionalWebUrl,
    intro: short(200),
  }),
  z.object({
    ...blockBase,
    type: z.literal("hours"),
    title: short(60),
    rows: z.array(z.object({ id, day: short(40), value: short(80) })).max(14),
    note: short(200),
  }),
  z.object({
    ...blockBase,
    type: z.literal("services"),
    title: short(60),
    items: z.array(z.object({ id, name: short(80), description: short(240) })).max(20),
  }),
  z.object({
    ...blockBase,
    type: z.literal("leadForm"),
    title: short(60),
    intro: short(300),
    buttonLabel: short(40),
    fields: z.object({
      name: fieldMode,
      email: fieldMode,
      phone: fieldMode,
      company: fieldMode,
      message: fieldMode,
    }),
  }),
]);
export type CardBlock = z.infer<typeof blockSchema>;
export type BlockType = CardBlock["type"];

export const documentSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    theme: themeSchema,
    identity: identitySchema,
    banner: bannerSchema,
    blocks: z.array(blockSchema).max(40),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    doc.blocks.forEach((b, i) => {
      if (ids.has(b.id)) ctx.addIssue({ code: "custom", path: ["blocks", i, "id"], message: "Identifiant de bloc dupliqué" });
      ids.add(b.id);
      if (b.type === "leadForm" && b.fields.email === "off" && b.fields.phone === "off") {
        ctx.addIssue({
          code: "custom",
          path: ["blocks", i, "fields"],
          message: "Le formulaire doit demander au moins un email ou un téléphone pour pouvoir recontacter",
        });
      }
    });
    if (doc.blocks.filter((b) => b.type === "leadForm").length > 1) {
      ctx.addIssue({ code: "custom", path: ["blocks"], message: "Un seul formulaire de contact par carte" });
    }
  });

export type CardDocument = z.infer<typeof documentSchema>;

/** Migration des anciens documents vers le schéma courant. */
export function migrateDocument(raw: unknown): unknown {
  if (raw && typeof raw === "object" && (raw as { schemaVersion?: unknown }).schemaVersion === CURRENT_SCHEMA_VERSION) {
    return raw;
  }
  // Aucune version antérieure n'existe encore.
  return raw;
}

export function parseDocument(raw: unknown) {
  return documentSchema.safeParse(migrateDocument(raw));
}

/** Tous les médias référencés par un document (pour contrôle d'appartenance et accès public). */
export function collectMediaIds(doc: CardDocument): string[] {
  const ids = new Set<string>();
  if (doc.identity.photoMediaId) ids.add(doc.identity.photoMediaId);
  if (doc.identity.logoMediaId) ids.add(doc.identity.logoMediaId);
  if (doc.banner.mediaId) ids.add(doc.banner.mediaId);
  for (const b of doc.blocks) {
    if (b.type === "gallery" || b.type === "documents") b.items.forEach((i) => i.mediaId && ids.add(i.mediaId));
  }
  return [...ids];
}

/** Vérifications supplémentaires exigées pour publier (le brouillon peut être incomplet). */
export function publishProblems(doc: CardDocument): string[] {
  const problems: string[] = [];
  if (!doc.identity.firstName && !doc.identity.lastName && !doc.identity.company) {
    problems.push("Renseignez au moins un nom ou une société.");
  }
  for (const b of doc.blocks) {
    if (b.hidden) continue;
    if (b.type === "links" && b.items.some((i) => !i.url || !i.title)) problems.push("Chaque lien doit avoir un titre et une adresse.");
    if (b.type === "social" && b.items.some((i) => !i.url)) problems.push("Chaque réseau doit avoir une adresse.");
    if (b.type === "appointment" && !b.url) problems.push("Le bloc rendez-vous doit avoir une adresse.");
    if (b.type === "reviews" && !b.readUrl && !b.writeUrl) problems.push("Le bloc avis doit contenir au moins un lien (consulter ou laisser un avis).");
    if (b.type === "video" && (!b.provider || !b.videoId)) problems.push("Le bloc vidéo doit contenir une vidéo YouTube ou Vimeo.");
    if ((b.type === "gallery" || b.type === "documents") && b.items.some((i) => !i.mediaId)) problems.push("Chaque élément de galerie ou de document doit avoir un fichier.");
  }
  return [...new Set(problems)];
}
