/**
 * Matrice de permissions centralisée. Toute vérification d'accès passe par can().
 * Le contexte (rôle) vient TOUJOURS de l'appartenance réelle lue en base à partir de la
 * session, jamais d'un identifiant fourni par le navigateur.
 */

export const ORG_ROLES = ["owner", "manager", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Propriétaire",
  manager: "Gestionnaire",
  member: "Collaborateur",
};

export type Permission =
  | "org.view"
  | "org.update"
  | "org.delete"
  | "org.transferOwnership"
  | "billing.view"
  | "billing.manage"
  | "members.view"
  | "members.manage"
  | "brand.update"
  | "brand.lock"
  | "cards.create"
  | "cards.manageAll"
  | "cards.assign"
  | "media.upload"
  | "leads.viewAll"
  | "analytics.viewAll"
  | "service.order"
  | "audit.view"
  | "support.create";

export interface MemberContext {
  role: OrgRole;
  canManageBilling: boolean;
}

const MATRIX: Record<OrgRole, Permission[]> = {
  owner: [
    "org.view", "org.update", "org.delete", "org.transferOwnership", "billing.view", "billing.manage",
    "members.view", "members.manage", "brand.update", "brand.lock", "cards.create", "cards.manageAll",
    "cards.assign", "media.upload", "leads.viewAll", "analytics.viewAll", "service.order", "audit.view",
    "support.create",
  ],
  manager: [
    "org.view", "members.view", "members.manage", "brand.update", "cards.create", "cards.manageAll",
    "cards.assign", "media.upload", "leads.viewAll", "analytics.viewAll", "support.create",
  ],
  member: ["org.view", "media.upload", "support.create"],
};

/** Permissions accordées à un gestionnaire disposant explicitement de l'accès facturation. */
const BILLING_DELEGATED: Permission[] = ["billing.view", "billing.manage", "service.order"];

export function can(ctx: MemberContext | null | undefined, permission: Permission): boolean {
  if (!ctx) return false;
  if (MATRIX[ctx.role]?.includes(permission)) return true;
  if (ctx.role === "manager" && ctx.canManageBilling && BILLING_DELEGATED.includes(permission)) return true;
  return false;
}

/** Un gestionnaire ne peut ni créer, ni modifier, ni retirer un propriétaire. */
export function canAssignRole(actor: MemberContext, targetRole: OrgRole, currentTargetRole?: OrgRole): boolean {
  if (!can(actor, "members.manage")) return false;
  if (actor.role === "owner") return targetRole !== "owner"; // le transfert de propriété est une action dédiée
  if (actor.role === "manager") {
    if (targetRole === "owner") return false;
    // Un gestionnaire ne gère que les collaborateurs : il ne peut ni viser ni créer un autre gestionnaire.
    if (currentTargetRole === "owner" || currentTargetRole === "manager") return false;
    if (targetRole === "manager") return false;
    return true;
  }
  return false;
}

export function isOrgRole(v: unknown): v is OrgRole {
  return typeof v === "string" && (ORG_ROLES as readonly string[]).includes(v);
}

/** Rôles plateforme, distincts des rôles d'organisation. */
export type PlatformRole = "admin" | "support";

export type PlatformPermission =
  | "platform.view"
  | "platform.orgs.suspend"
  | "platform.cards.suspend"
  | "platform.plans.manage"
  | "platform.billing.sync"
  | "platform.finance.export"
  | "platform.support.respond"
  | "platform.support.access"
  | "platform.service.manage"
  | "platform.settings.manage"
  | "platform.audit.view"
  | "platform.backups.manage";

const PLATFORM_MATRIX: Record<PlatformRole, PlatformPermission[]> = {
  admin: [
    "platform.view", "platform.orgs.suspend", "platform.cards.suspend", "platform.plans.manage",
    "platform.billing.sync", "platform.finance.export", "platform.support.respond", "platform.support.access",
    "platform.service.manage", "platform.settings.manage", "platform.audit.view", "platform.backups.manage",
  ],
  support: [
    "platform.view", "platform.cards.suspend", "platform.support.respond", "platform.support.access",
    "platform.service.manage",
  ],
};

export function platformCan(role: string | null | undefined, permission: PlatformPermission): boolean {
  if (role !== "admin" && role !== "support") return false;
  return PLATFORM_MATRIX[role].includes(permission);
}
