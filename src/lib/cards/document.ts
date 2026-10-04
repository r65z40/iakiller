import { z } from "zod";
import { CONTACT_KINDS, CURRENT_SCHEMA_VERSION, FONTS, LINK_ICONS, SOCIAL_NETWORKS, TEMPLATES, type FontId } from "./constants";

// Constantes sans dépendance (utilisables côté navigateur sans embarquer Zod).
export { CONTACT_KINDS, CURRENT_SCHEMA_VERSION, FONTS, LINK_ICONS, SOCIAL_NETWORKS, TEMPLATES };
export type { ContactKind, FontId, TemplateId } from "./constants";
import { isHexColor, normalizePhone, normalizeWebUrl, isValidEmail } from "@/lib/validation/urls";

/**
 * Document de carte, versionné (schemaVersion). Le même document est rendu par tous
 * les modèles : un modèle ne change que la présentation, jamais les données.
 * Toute évolution du format doit incrémenter CURRENT_SCHEMA_VERSION et fournir une
 * migration dans migrateDocument().
 */
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


const fieldMode = z.enum(["off", "optional", "required"]);

/** Types de champ personnalisé proposés dans le formulaire sur mesure. */
export const CUSTOM_FIELD_TYPES = ["text", "textarea", "tel", "email", "date", "select"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/** Champ de formulaire défini librement par l'utilisateur (libellé, type, obligatoire, options). */
const customField = z.object({
  id,
  label: short(60),
  type: z.enum(CUSTOM_FIELD_TYPES),
  required: z.boolean(),
  /** Choix proposés pour un champ « liste déroulante » ; ignoré pour les autres types. */
  options: z.array(short(60)).max(20).default([]),
});
export type CustomField = z.infer<typeof customField>;

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
    /** Champs sur mesure ajoutés par l'utilisateur (ex. « Date souhaitée », « Type de prestation »). */
    customFields: z.array(customField).max(12).default([]),
    /** Adresses email supplémentaires qui reçoivent une notification de demande (validées à l'envoi). */
    notifyEmails: z.array(short(254)).max(5).default([]),
    /** Inclure le détail de la demande dans l'email de notification (sinon, consultable dans l'espace). */
    includeContentInEmail: z.boolean().default(false),
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
      if (b.type === "leadForm") {
        const hasStandardContact = b.fields.email !== "off" || b.fields.phone !== "off";
        const hasCustomContact = b.customFields.some((f) => f.type === "email" || f.type === "tel");
        if (!hasStandardContact && !hasCustomContact) {
          ctx.addIssue({
            code: "custom",
            path: ["blocks", i, "fields"],
            message: "Le formulaire doit demander au moins un email ou un téléphone pour pouvoir recontacter",
          });
        }
        const fieldIds = new Set<string>();
        b.customFields.forEach((f, j) => {
          if (fieldIds.has(f.id)) ctx.addIssue({ code: "custom", path: ["blocks", i, "customFields", j, "id"], message: "Identifiant de champ dupliqué" });
          fieldIds.add(f.id);
          if (!f.label.trim()) ctx.addIssue({ code: "custom", path: ["blocks", i, "customFields", j, "label"], message: "Donnez un libellé à ce champ" });
          if (f.type === "select" && f.options.filter((o) => o.trim()).length === 0) {
            ctx.addIssue({ code: "custom", path: ["blocks", i, "customFields", j, "options"], message: "Ajoutez au moins un choix pour une liste déroulante" });
          }
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
/**
 * Projection publique d'une carte : tout ce qui n'est pas visible est retiré AVANT que le
 * document ne quitte le serveur. Sans cela, le contenu des blocs masqués et la photo ou le
 * logo masqués seraient sérialisés dans la page publique (et leurs fichiers servis par /m).
 */
export function publicDocument(doc: CardDocument): CardDocument {
  return {
    ...doc,
    identity: {
      ...doc.identity,
      photoMediaId: doc.identity.showPhoto ? doc.identity.photoMediaId : "",
      logoMediaId: doc.identity.showLogo ? doc.identity.logoMediaId : "",
    },
    blocks: doc.blocks
      .filter((b) => !b.hidden)
      .map((b): CardBlock => {
        if (b.type === "gallery") return { ...b, items: b.items.filter((i) => i.mediaId) };
        if (b.type === "documents") return { ...b, items: b.items.filter((i) => i.mediaId) };
        // Les réglages de notification du formulaire sont internes : jamais exposés publiquement.
        if (b.type === "leadForm") return { ...b, notifyEmails: [], includeContentInEmail: false };
        return b;
      }),
  };
}

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
