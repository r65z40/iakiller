import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId, newToken, sha256 } from "@/lib/ids";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { can, canAssignRole, isOrgRole, ROLE_LABELS, type OrgRole } from "@/lib/permissions";
import { isValidEmail } from "@/lib/validation/urls";
import { sendEmail } from "@/lib/email/send";
import { templates } from "@/lib/email/templates";
import { loadEntitlement } from "@/lib/billing/load";
import type { Actor } from "@/lib/cards/service";

const INVITATION_DAYS = 7;

function actorType(actor: Actor) {
  return actor.supportGrantId ? ("staff" as const) : ("user" as const);
}

/**
 * La gestion des membres est interdite en mode assistance : sinon un membre de l'équipe
 * pourrait s'inviter lui-même comme gestionnaire et obtenir un accès durable, survivant à
 * l'expiration de l'accès d'assistance. L'assistance modifie le contenu, pas la composition
 * de l'organisation.
 */
function assertNotSupportMode(actor: Actor) {
  if (actor.supportGrantId) throw new DomainError("forbidden", "La gestion des membres n'est pas possible en mode assistance.");
}

export async function listMembers(actor: Actor) {
  if (!can(actor, "members.view")) throw new DomainError("forbidden", "Accès réservé.");
  return db
    .select({ membership: schema.membership, user: { id: schema.user.id, name: schema.user.name, email: schema.user.email } })
    .from(schema.membership)
    .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
    .where(eq(schema.membership.organizationId, actor.organization.id));
}

export async function listPendingInvitations(actor: Actor) {
  if (!can(actor, "members.view")) throw new DomainError("forbidden", "Accès réservé.");
  return db
    .select()
    .from(schema.invitation)
    .where(and(eq(schema.invitation.organizationId, actor.organization.id), isNull(schema.invitation.acceptedAt), isNull(schema.invitation.revokedAt), gt(schema.invitation.expiresAt, new Date())));
}

/** Invitation par email : jeton à usage unique, stocké uniquement sous forme d'empreinte. */
export async function inviteMember(actor: Actor, rawEmail: string, role: OrgRole, inviterName: string) {
  assertNotSupportMode(actor);
  const email = rawEmail.trim().toLowerCase();
  if (!isValidEmail(email)) throw new DomainError("invalid", "Adresse email invalide.");
  if (!isOrgRole(role) || !canAssignRole(actor, role)) throw new DomainError("forbidden", "Vous ne pouvez pas attribuer ce rôle.");
  const token = newToken(24);
  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 86400_000);

  const orgName = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${schema.organization} where id = ${actor.organization.id} for update`);
    const ent = await loadEntitlement(actor.organization.id, tx);
    const [members] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.membership).where(eq(schema.membership.organizationId, actor.organization.id));
    const [pending] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.invitation)
      .where(and(eq(schema.invitation.organizationId, actor.organization.id), isNull(schema.invitation.acceptedAt), isNull(schema.invitation.revokedAt), gt(schema.invitation.expiresAt, new Date())));
    if ((members?.n ?? 0) + (pending?.n ?? 0) >= ent.quotas.members) {
      throw new DomainError("quota_exceeded", `Votre formule permet ${ent.quotas.members} membre(s), invitations en attente comprises.`);
    }
    const [existing] = await tx
      .select({ id: schema.membership.id })
      .from(schema.membership)
      .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
      .where(and(eq(schema.membership.organizationId, actor.organization.id), eq(sql`lower(${schema.user.email})`, email)));
    if (existing) throw new DomainError("invalid", "Cette personne est déjà membre.");
    // Une nouvelle invitation remplace les précédentes pour la même adresse.
    await tx
      .update(schema.invitation)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.invitation.organizationId, actor.organization.id), eq(schema.invitation.email, email), isNull(schema.invitation.acceptedAt), isNull(schema.invitation.revokedAt)));
    const id = newId();
    await tx.insert(schema.invitation).values({ id, organizationId: actor.organization.id, email, role, tokenHash: sha256(token), invitedById: actor.user.id, expiresAt });
    await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: actorType(actor), supportGrantId: actor.supportGrantId, action: "member.invite", targetType: "invitation", targetId: id, metadata: { role } }, tx);
    const [org] = await tx.select({ name: schema.organization.name }).from(schema.organization).where(eq(schema.organization.id, actor.organization.id));
    return org.name;
  });

  await sendEmail({
    to: email,
    template: "invitation",
    email: templates.invitation({ orgName, inviter: inviterName, role: ROLE_LABELS[role].toLowerCase(), url: `${appUrl()}/invitation/${token}`, expires: formatDateTime(expiresAt) }),
  });
}

export async function revokeInvitation(actor: Actor, invitationId: string) {
  assertNotSupportMode(actor);
  if (!can(actor, "members.manage")) throw new DomainError("forbidden", "Action réservée.");
  await db
    .update(schema.invitation)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.invitation.id, invitationId), eq(schema.invitation.organizationId, actor.organization.id)));
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: actorType(actor), action: "member.invite_revoke", targetId: invitationId });
}

export async function findInvitation(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db
    .select({ invitation: schema.invitation, organization: schema.organization })
    .from(schema.invitation)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.invitation.organizationId))
    .where(eq(schema.invitation.tokenHash, sha256(token)));
  if (!row) return null;
  const inv = row.invitation;
  const state = inv.revokedAt ? "revoked" : inv.acceptedAt ? "accepted" : inv.expiresAt <= new Date() ? "expired" : "valid";
  return { ...row, state } as const;
}

/** Acceptation : l'adresse du compte connecté doit être celle qui a été invitée. */
export async function acceptInvitation(user: { id: string; email: string; emailVerified: boolean }, token: string) {
  const found = await findInvitation(token);
  if (!found || found.state !== "valid") throw new DomainError("invalid", "Invitation invalide, expirée ou déjà utilisée.");
  if (!user.emailVerified) throw new DomainError("forbidden", "Confirmez d'abord votre adresse email.");
  if (user.email.toLowerCase() !== found.invitation.email.toLowerCase()) {
    throw new DomainError("forbidden", `Cette invitation est destinée à ${found.invitation.email}. Connectez-vous avec cette adresse.`);
  }
  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${schema.organization} where id = ${found.invitation.organizationId} for update`);
    // Le quota est revérifié à l'acceptation : une invitation émise sous un ancien quota (ou
    // avant une rétrogradation) ne doit pas faire dépasser la formule en cours.
    const ent = await loadEntitlement(found.invitation.organizationId, tx);
    const [members] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.membership).where(eq(schema.membership.organizationId, found.invitation.organizationId));
    if ((members?.n ?? 0) >= ent.quotas.members) throw new DomainError("quota_exceeded", "Cette organisation a atteint le nombre de membres de sa formule. Demandez au propriétaire de faire de la place.");
    const marked = await tx
      .update(schema.invitation)
      .set({ acceptedAt: new Date() })
      .where(and(eq(schema.invitation.id, found.invitation.id), isNull(schema.invitation.acceptedAt), isNull(schema.invitation.revokedAt)))
      .returning({ id: schema.invitation.id });
    if (marked.length === 0) throw new DomainError("invalid", "Invitation déjà utilisée.");
    await tx
      .insert(schema.membership)
      .values({ id: newId(), organizationId: found.invitation.organizationId, userId: user.id, role: found.invitation.role, canManageBilling: false })
      .onConflictDoNothing();
    // Cartes préparées pour cette personne (import CSV) : attribution à l'arrivée.
    const pending = await tx
      .delete(schema.pendingCardAssignment)
      .where(and(eq(schema.pendingCardAssignment.organizationId, found.invitation.organizationId), eq(schema.pendingCardAssignment.email, found.invitation.email.toLowerCase())))
      .returning({ cardId: schema.pendingCardAssignment.cardId });
    if (pending.length) {
      await tx
        .insert(schema.cardAssignment)
        .values(pending.map((p) => ({ cardId: p.cardId, userId: user.id, organizationId: found.invitation.organizationId })))
        .onConflictDoNothing();
    }
    await audit({ organizationId: found.invitation.organizationId, actorUserId: user.id, actorType: "user", action: "member.join", metadata: { role: found.invitation.role } }, tx);
  });
  return found.organization;
}

export async function changeMemberRole(actor: Actor, membershipId: string, role: OrgRole, canManageBilling = false) {
  assertNotSupportMode(actor);
  const [m] = await db.select().from(schema.membership).where(and(eq(schema.membership.id, membershipId), eq(schema.membership.organizationId, actor.organization.id)));
  if (!m) throw new DomainError("not_found", "Membre introuvable");
  if (!isOrgRole(role) || !isOrgRole(m.role) || !canAssignRole(actor, role, m.role)) throw new DomainError("forbidden", "Modification de rôle non autorisée.");
  if (m.userId === actor.user.id) throw new DomainError("invalid", "Vous ne pouvez pas modifier votre propre rôle.");
  // Seul le propriétaire délègue la facturation.
  const billing = role === "manager" && actor.role === "owner" ? canManageBilling : false;
  await db.update(schema.membership).set({ role, canManageBilling: billing, updatedAt: new Date() }).where(eq(schema.membership.id, m.id));
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: actorType(actor), action: "member.role", targetType: "user", targetId: m.userId, metadata: { from: m.role, to: role, billing } });
}

/**
 * Retrait d'un membre (ex. salarié sortant) : ses droits disparaissent immédiatement
 * (l'appartenance est vérifiée à chaque requête). Option : désactiver ses cartes.
 */
export async function removeMember(actor: Actor, membershipId: string, opts: { disableAssignedCards: boolean }) {
  assertNotSupportMode(actor);
  if (!can(actor, "members.manage")) throw new DomainError("forbidden", "Action réservée.");
  const [m] = await db.select().from(schema.membership).where(and(eq(schema.membership.id, membershipId), eq(schema.membership.organizationId, actor.organization.id)));
  if (!m) throw new DomainError("not_found", "Membre introuvable");
  if (m.role === "owner") throw new DomainError("invalid", "Le propriétaire ne peut pas être retiré. Transférez d'abord la propriété.");
  if (actor.role === "manager" && m.role === "manager" && m.userId !== actor.user.id) {
    // Proposition : un gestionnaire peut retirer des collaborateurs, pas d'autres gestionnaires.
    throw new DomainError("forbidden", "Seul le propriétaire peut retirer un gestionnaire.");
  }
  await db.transaction(async (tx) => {
    const assigned = await tx
      .select({ cardId: schema.cardAssignment.cardId })
      .from(schema.cardAssignment)
      .where(and(eq(schema.cardAssignment.userId, m.userId), eq(schema.cardAssignment.organizationId, actor.organization.id)));
    if (opts.disableAssignedCards && assigned.length) {
      for (const a of assigned) {
        await tx.update(schema.card).set({ disabledAt: new Date(), updatedAt: new Date() }).where(and(eq(schema.card.id, a.cardId), eq(schema.card.organizationId, actor.organization.id)));
      }
    }
    await tx.delete(schema.cardAssignment).where(and(eq(schema.cardAssignment.userId, m.userId), eq(schema.cardAssignment.organizationId, actor.organization.id)));
    await tx.delete(schema.membership).where(eq(schema.membership.id, m.id));
    await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: actorType(actor), action: "member.remove", targetType: "user", targetId: m.userId, metadata: { disabledCards: opts.disableAssignedCards ? assigned.length : 0 } }, tx);
  });
}

export async function leaveOrganization(actor: Actor) {
  if (actor.role === "owner") throw new DomainError("invalid", "Transférez la propriété avant de quitter l'organisation.");
  await db.transaction(async (tx) => {
    await tx.delete(schema.cardAssignment).where(and(eq(schema.cardAssignment.userId, actor.user.id), eq(schema.cardAssignment.organizationId, actor.organization.id)));
    await tx.delete(schema.membership).where(and(eq(schema.membership.userId, actor.user.id), eq(schema.membership.organizationId, actor.organization.id)));
    await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "member.leave" }, tx);
  });
}
