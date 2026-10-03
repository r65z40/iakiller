import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { CardDocument } from "@/lib/cards/document";

/**
 * Conventions
 * - Identifiants : texte aléatoire (voir lib/ids.ts), indépendants des slugs.
 * - Horodatages : timestamptz, stockés en UTC.
 * - Montants : entiers en centimes.
 * - Toute table métier porte organization_id pour un contrôle d'appartenance systématique.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

// ---------------------------------------------------------------------------
// Authentification (tables attendues par Better Auth)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  /** Rôle plateforme : null (client), "support" ou "admin". Jamais attribué à l'inscription. */
  platformRole: text("platform_role"),
  /** Compte désactivé par la plateforme. */
  disabledAt: ts("disabled_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: ts("locked_until"),
  },
  (t) => [index("two_factor_user_idx").on(t.userId), index("two_factor_secret_idx").on(t.secret)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ---------------------------------------------------------------------------
// Organisations et membres
// ---------------------------------------------------------------------------

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /** Début et fin d'essai (UTC). Null tant que l'essai n'a pas démarré. */
  trialStartedAt: ts("trial_started_at"),
  trialEndsAt: ts("trial_ends_at"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  /** Suspension administrative (abus, fraude…), indépendante de la facturation. */
  adminSuspendedAt: ts("admin_suspended_at"),
  adminSuspendedReason: text("admin_suspended_reason"),
  /** Autorise l'indexation des cartes par les moteurs (désactivé par défaut). */
  allowIndexing: boolean("allow_indexing").notNull().default(false),
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  deletedAt: ts("deleted_at"),
  /** Contenus effacés par la politique de conservation (les références comptables restent). */
  purgedAt: ts("purged_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const membership = pgTable(
  "membership",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** owner | manager | member */
    role: text("role").notNull(),
    /** Option : un gestionnaire peut recevoir l'accès facturation. */
    canManageBilling: boolean("can_manage_billing").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("membership_org_user_uq").on(t.organizationId, t.userId),
    index("membership_user_idx").on(t.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(),
    /** Empreinte SHA-256 du jeton envoyé par email ; le jeton brut n'est jamais stocké. */
    tokenHash: text("token_hash").notNull().unique(),
    invitedById: text("invited_by_id").references(() => user.id, { onDelete: "set null" }),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [index("invitation_org_idx").on(t.organizationId)],
);

export const brandSettings = pgTable("brand_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  primaryColor: text("primary_color").notNull().default("#0047BB"),
  backgroundColor: text("background_color").notNull().default("#EEF2F8"),
  textColor: text("text_color").notNull().default("#14213D"),
  font: text("font").notNull().default("inter"),
  logoMediaId: text("logo_media_id"),
  companyName: text("company_name"),
  /** Liste des champs verrouillés par le propriétaire (voir lib/brand.ts). */
  lockedFields: jsonb("locked_fields").$type<string[]>().notNull().default([]),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Cartes
// ---------------------------------------------------------------------------

export const card = pgTable(
  "card",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    /** Jeton aléatoire stable utilisé par le QR code : /r/{publicToken}. */
    publicToken: text("public_token").notNull().unique(),
    /** draft | published | archived */
    status: text("status").notNull().default("draft"),
    title: text("title").notNull(),
    draft: jsonb("draft").$type<CardDocument>().notNull(),
    /** Incrémenté à chaque sauvegarde du brouillon ; sert à détecter les conflits. */
    draftRevision: integer("draft_revision").notNull().default(1),
    draftUpdatedAt: ts("draft_updated_at").notNull().defaultNow(),
    publishedVersionId: text("published_version_id"),
    publishedAt: ts("published_at"),
    /** Désactivation par l'organisation (ex. salarié sortant). */
    disabledAt: ts("disabled_at"),
    /** Suspension par la plateforme, avec motif. */
    adminSuspendedAt: ts("admin_suspended_at"),
    adminSuspendedReason: text("admin_suspended_reason"),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("card_org_slug_uq").on(t.organizationId, t.slug),
    index("card_org_status_idx").on(t.organizationId, t.status),
  ],
);

export const cardAssignment = pgTable(
  "card_assignment",
  {
    cardId: text("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.userId] }), index("card_assignment_user_idx").on(t.userId)],
);

/** Instantanés immuables publiés ou sauvegardés explicitement. */
export const cardVersion = pgTable(
  "card_version",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    document: jsonb("document").$type<CardDocument>().notNull(),
    /** Médias référencés par cette version (contrôle d'accès public). */
    mediaIds: jsonb("media_ids").$type<string[]>().notNull().default([]),
    /** published | snapshot */
    kind: text("kind").notNull().default("published"),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("card_version_card_number_uq").on(t.cardId, t.number)],
);

/**
 * Anciennes adresses. Une ancienne adresse d'organisation reste réservée à la même
 * organisation : un autre client ne peut pas la reprendre (anti-détournement).
 */
export const slugRedirect = pgTable(
  "slug_redirect",
  {
    id: text("id").primaryKey(),
    /** organization | card */
    kind: text("kind").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    cardId: text("card_id").references(() => card.id, { onDelete: "cascade" }),
    oldSlug: text("old_slug").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("slug_redirect_org_uq").on(t.oldSlug).where(sql`kind = 'organization'`),
    uniqueIndex("slug_redirect_card_uq").on(t.organizationId, t.oldSlug).where(sql`kind = 'card'`),
  ],
);

// ---------------------------------------------------------------------------
// Médias
// ---------------------------------------------------------------------------

export const mediaAsset = pgTable(
  "media_asset",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** image | document */
    kind: text("kind").notNull(),
    mimeType: text("mime_type").notNull(),
    /** Clé de stockage aléatoire, sans nom d'origine. */
    storageKey: text("storage_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    uploadedById: text("uploaded_by_id").references(() => user.id, { onDelete: "set null" }),
    deletedAt: ts("deleted_at"),
    createdAt: createdAt(),
  },
  (t) => [index("media_org_idx").on(t.organizationId)],
);

// ---------------------------------------------------------------------------
// Plans, abonnements, facturation
// ---------------------------------------------------------------------------

export const plan = pgTable("plan", {
  id: text("id").primaryKey(),
  /** individuel | equipe | entreprise */
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  cardQuota: integer("card_quota").notNull(),
  storageQuotaMb: integer("storage_quota_mb").notNull(),
  memberQuota: integer("member_quota").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  /** Valeurs de démonstration : bloque le lancement commercial. */
  isDemo: boolean("is_demo").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const planPrice = pgTable(
  "plan_price",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "restrict" }),
    /** month | year */
    interval: text("interval").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("eur"),
    /** Le montant saisi est-il HT ou TTC ? À valider selon la situation fiscale. */
    taxBehavior: text("tax_behavior").notNull().default("unspecified"),
    stripePriceId: text("stripe_price_id").unique(),
    isActive: boolean("is_active").notNull().default(true),
    isDemo: boolean("is_demo").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("plan_price_plan_idx").on(t.planId)],
);

/** État d'abonnement synchronisé depuis Stripe (source de vérité : Stripe). */
export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripePriceId: text("stripe_price_id"),
    planPriceId: text("plan_price_id").references(() => planPrice.id, { onDelete: "set null" }),
    /** Statut Stripe brut (active, past_due, canceled…). */
    status: text("status").notNull(),
    currentPeriodEnd: ts("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    cancelAt: ts("cancel_at"),
    endedAt: ts("ended_at"),
    /** Date du premier échec de paiement de l'épisode d'impayé en cours. */
    pastDueSince: ts("past_due_since"),
    /** Horodatage Stripe (event.created) de la dernière synchronisation. */
    lastSyncedAt: ts("last_synced_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("subscription_org_idx").on(t.organizationId)],
);

/** Journal des webhooks reçus. L'unicité de l'identifiant Stripe garantit l'idempotence. */
export const billingEvent = pgTable("billing_event", {
  id: text("id").primaryKey(),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  type: text("type").notNull(),
  livemode: boolean("livemode").notNull(),
  stripeCreatedAt: ts("stripe_created_at").notNull(),
  organizationId: text("organization_id"),
  /** received | processed | ignored | failed */
  status: text("status").notNull(),
  error: text("error"),
  receivedAt: ts("received_at").notNull().defaultNow(),
  processedAt: ts("processed_at"),
});

export const invoiceReference = pgTable(
  "invoice_reference",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    stripeInvoiceId: text("stripe_invoice_id").notNull().unique(),
    number: text("number"),
    status: text("status").notNull(),
    amountDueCents: integer("amount_due_cents").notNull(),
    amountPaidCents: integer("amount_paid_cents").notNull(),
    currency: text("currency").notNull(),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    invoicePdfUrl: text("invoice_pdf_url"),
    issuedAt: ts("issued_at"),
    createdAt: createdAt(),
  },
  (t) => [index("invoice_org_idx").on(t.organizationId)],
);

// ---------------------------------------------------------------------------
// Création accompagnée
// ---------------------------------------------------------------------------

export const serviceOffer = pgTable("service_offer", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("eur"),
  includedRevisions: integer("included_revisions").notNull(),
  /** Délai indicatif interne en jours ouvrés ; non affiché publiquement tant que non validé. */
  targetDays: integer("target_days"),
  stripePriceId: text("stripe_price_id").unique(),
  isActive: boolean("is_active").notNull().default(true),
  isDemo: boolean("is_demo").notNull().default(true),
  createdAt: createdAt(),
});

export const serviceOrder = pgTable(
  "service_order",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    offerId: text("offer_id")
      .notNull()
      .references(() => serviceOffer.id, { onDelete: "restrict" }),
    /** requested | awaiting_payment | brief_received | in_progress | client_review | revisions | delivered | closed | cancelled */
    status: text("status").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    brief: jsonb("brief").$type<Record<string, string>>().notNull().default({}),
    revisionsUsed: integer("revisions_used").notNull().default(0),
    includedRevisions: integer("included_revisions").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    paidAt: ts("paid_at"),
    cardId: text("card_id").references(() => card.id, { onDelete: "set null" }),
    assignedToId: text("assigned_to_id").references(() => user.id, { onDelete: "set null" }),
    refundRequestedAt: ts("refund_requested_at"),
    refundNote: text("refund_note"),
    requestedById: text("requested_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("service_order_org_idx").on(t.organizationId)],
);

export const serviceOrderMessage = pgTable(
  "service_order_message",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => serviceOrder.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    fromPlatform: boolean("from_platform").notNull().default(false),
    body: text("body").notNull(),
    mediaId: text("media_id"),
    createdAt: createdAt(),
  },
  (t) => [index("service_order_message_order_idx").on(t.orderId)],
);

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

export const analyticsEvent = pgTable(
  "analytics_event",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    /** Identifiant aléatoire d'un affichage de page, non persistant côté visiteur. */
    viewId: text("view_id").notNull(),
    type: text("type").notNull(),
    /** Cible de l'action (ex. "linkedin", identifiant de bloc), jamais de contenu saisi. */
    target: text("target"),
    source: text("source").notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    device: text("device").notNull(),
    browser: text("browser").notNull(),
    country: text("country"),
    isBot: boolean("is_bot").notNull().default(false),
    /** Visite d'un membre connecté de l'organisation ou d'un administrateur. */
    isInternal: boolean("is_internal").notNull().default(false),
    occurredAt: ts("occurred_at").notNull().defaultNow(),
  },
  (t) => [
    index("analytics_org_time_idx").on(t.organizationId, t.occurredAt),
    index("analytics_card_time_idx").on(t.cardId, t.occurredAt),
    uniqueIndex("analytics_view_type_target_uq").on(t.viewId, t.type, t.target),
  ],
);

/** Agrégats journaliers conservés après purge des événements bruts. */
export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    /** Jour civil Europe/Paris, AAAA-MM-JJ. */
    day: text("day").notNull(),
    type: text("type").notNull(),
    source: text("source").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.day, t.type, t.source] })],
);

// ---------------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------------

export const lead = pgTable(
  "lead",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    cardId: text("card_id").references(() => card.id, { onDelete: "set null" }),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    company: text("company"),
    message: text("message"),
    /** Accord marketing distinct, facultatif, décoché par défaut. */
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    /** new | contacted | done */
    status: text("status").notNull().default("new"),
    notes: text("notes"),
    /** Empreinte de déduplication (carte + email/téléphone + message). */
    dedupeHash: text("dedupe_hash").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("lead_org_time_idx").on(t.organizationId, t.createdAt),
    index("lead_dedupe_idx").on(t.dedupeHash, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Support, assistance, audit, emails, tâches
// ---------------------------------------------------------------------------

export const supportTicket = pgTable(
  "support_ticket",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    subject: text("subject").notNull(),
    /** open | pending | closed */
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("support_ticket_org_idx").on(t.organizationId)],
);

export const supportMessage = pgTable("support_message", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id")
    .notNull()
    .references(() => supportTicket.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
  fromPlatform: boolean("from_platform").notNull().default(false),
  body: text("body").notNull(),
  mediaId: text("media_id"),
  createdAt: createdAt(),
});

/** Accès d'assistance temporaire d'un membre de la plateforme à une organisation. */
export const supportAccessGrant = pgTable(
  "support_access_grant",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    staffUserId: text("staff_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    serviceOrderId: text("service_order_id"),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [index("support_access_org_idx").on(t.organizationId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id"),
    actorUserId: text("actor_user_id"),
    /** user | staff | system | stripe */
    actorType: text("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    supportGrantId: text("support_grant_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_org_time_idx").on(t.organizationId, t.createdAt),
    index("audit_time_idx").on(t.createdAt),
  ],
);

/** Boîte d'envoi : en développement, rien ne part ; les emails sont consultables localement. */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: text("id").primaryKey(),
    to: text("to").notNull(),
    template: text("template").notNull(),
    subject: text("subject").notNull(),
    text: text("text").notNull(),
    html: text("html").notNull(),
    /** Clé d'idempotence (ex. "trial-ending:{orgId}") pour ne pas renvoyer deux fois. */
    dedupeKey: text("dedupe_key").unique(),
    /** pending | sent | logged | failed */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    sentAt: ts("sent_at"),
    createdAt: createdAt(),
  },
  (t) => [index("email_outbox_status_idx").on(t.status, t.createdAt)],
);

/** Configuration plateforme clé/valeur (textes de marque, règles). Jamais de secrets. */
export const platformSetting = pgTable("platform_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedById: text("updated_by_id"),
  updatedAt: updatedAt(),
});

export const jobRun = pgTable("job_run", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
  status: text("status").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
});
