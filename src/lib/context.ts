import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { can, isOrgRole, type MemberContext, type OrgRole, type Permission } from "@/lib/permissions";
import { loadEntitlement } from "@/lib/billing/load";
import type { Entitlement } from "@/lib/billing/entitlements";

export const ACTIVE_ORG_COOKIE = "active_org";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  platformRole: string | null;
  twoFactorEnabled: boolean;
  sessionId: string;
}

/** Utilisateur de la session courante, relu en base (désactivation, rôle plateforme). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [u] = await db.select().from(schema.user).where(eq(schema.user.id, session.user.id));
  if (!u || u.disabledAt) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    platformRole: u.platformRole,
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
    sessionId: session.session.id,
  };
});

export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export interface OrgContext extends MemberContext {
  user: CurrentUser;
  organization: typeof schema.organization.$inferSelect;
  membershipId: string | null;
  entitlement: Entitlement;
  /** Accès d'assistance d'un membre de la plateforme (toutes ses actions sont auditées). */
  supportGrantId: string | null;
}

export async function listMemberships(userId: string) {
  return db
    .select({ membership: schema.membership, organization: schema.organization })
    .from(schema.membership)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.membership.organizationId))
    .where(and(eq(schema.membership.userId, userId), isNull(schema.organization.deletedAt)))
    .orderBy(asc(schema.organization.createdAt));
}

async function activeSupportGrant(staffUserId: string, organizationId: string) {
  const [grant] = await db
    .select()
    .from(schema.supportAccessGrant)
    .where(
      and(
        eq(schema.supportAccessGrant.staffUserId, staffUserId),
        eq(schema.supportAccessGrant.organizationId, organizationId),
        isNull(schema.supportAccessGrant.revokedAt),
        gt(schema.supportAccessGrant.expiresAt, new Date()),
      ),
    );
  return grant ?? null;
}

/**
 * Contexte d'organisation active. L'identifiant vient d'un cookie, mais il n'est qu'une
 * PRÉFÉRENCE : l'appartenance est systématiquement revérifiée en base.
 */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const jar = await cookies();
  const wanted = jar.get(ACTIVE_ORG_COOKIE)?.value;

  const memberships = await listMemberships(user.id);
  const chosen = memberships.find((m) => m.organization.id === wanted) ?? (wanted ? undefined : memberships[0]);

  if (chosen && isOrgRole(chosen.membership.role)) {
    return {
      user,
      organization: chosen.organization,
      membershipId: chosen.membership.id,
      role: chosen.membership.role,
      canManageBilling: chosen.membership.canManageBilling,
      entitlement: await loadEntitlement(chosen.organization.id),
      supportGrantId: null,
    };
  }

  // Mode assistance : uniquement pour le personnel plateforme avec un accès explicite en cours.
  if (wanted && (user.platformRole === "admin" || user.platformRole === "support") && user.twoFactorEnabled) {
    const grant = await activeSupportGrant(user.id, wanted);
    if (grant) {
      const [org] = await db.select().from(schema.organization).where(eq(schema.organization.id, wanted));
      if (org) {
        return {
          user,
          organization: org,
          membershipId: null,
          role: "manager" as OrgRole,
          canManageBilling: false,
          entitlement: await loadEntitlement(org.id),
          supportGrantId: grant.id,
        };
      }
    }
  }

  // Préférence obsolète : retomber sur la première organisation.
  if (memberships[0] && isOrgRole(memberships[0].membership.role)) {
    const m = memberships[0];
    return {
      user,
      organization: m.organization,
      membershipId: m.membership.id,
      role: m.membership.role as OrgRole,
      canManageBilling: m.membership.canManageBilling,
      entitlement: await loadEntitlement(m.organization.id),
      supportGrantId: null,
    };
  }
  return null;
});

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "Accès refusé") {
    super(message);
  }
}

/** Pour les pages : redirige vers la connexion ou la création d'organisation. */
export async function requireOrgPage(permission?: Permission): Promise<OrgContext> {
  const user = await requireUser("/app");
  const ctx = await getOrgContext();
  if (!ctx) redirect(user ? "/app/organisations/nouvelle" : "/connexion");
  if (permission && !can(ctx, permission)) redirect("/app?refus=1");
  return ctx;
}

/** Pour les actions serveur et routes API : lève une erreur au lieu de rediriger. */
export async function requireOrgAction(permission?: Permission): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) throw new ForbiddenError("Session ou organisation invalide");
  if (permission && !can(ctx, permission)) throw new ForbiddenError();
  return ctx;
}

export function auditActor(ctx: OrgContext) {
  return {
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    actorType: ctx.supportGrantId ? ("staff" as const) : ("user" as const),
    supportGrantId: ctx.supportGrantId,
  };
}
