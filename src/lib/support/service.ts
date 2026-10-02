import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { can, platformCan } from "@/lib/permissions";
import { sendEmail } from "@/lib/email/send";
import { templates } from "@/lib/email/templates";
import type { Actor } from "@/lib/cards/service";
import type { Staff } from "@/lib/services/orders";

async function assertOrgMedia(organizationId: string, mediaId: string | null | undefined) {
  if (!mediaId) return null;
  const [m] = await db.select({ id: schema.mediaAsset.id }).from(schema.mediaAsset).where(and(eq(schema.mediaAsset.id, mediaId), eq(schema.mediaAsset.organizationId, organizationId), isNull(schema.mediaAsset.deletedAt)));
  if (!m) throw new DomainError("invalid", "Pièce jointe introuvable dans votre organisation.");
  return m.id;
}

export async function createTicket(actor: Actor, subject: string, body: string, mediaId?: string | null) {
  if (!can(actor, "support.create")) throw new DomainError("forbidden", "Action non autorisée.");
  const s = subject.trim().slice(0, 150);
  const b = body.trim().slice(0, 5000);
  if (s.length < 3 || b.length < 5) throw new DomainError("invalid", "Précisez l'objet et le message.");
  const attachment = await assertOrgMedia(actor.organization.id, mediaId);
  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(schema.supportTicket).values({ id, organizationId: actor.organization.id, userId: actor.user.id, subject: s });
    await tx.insert(schema.supportMessage).values({ id: newId(), ticketId: id, authorId: actor.user.id, body: b, mediaId: attachment });
  });
  return { id };
}

export async function listTickets(actor: Actor) {
  const conds = [eq(schema.supportTicket.organizationId, actor.organization.id)];
  // Un collaborateur ne voit que ses propres demandes.
  if (!can(actor, "members.view")) conds.push(eq(schema.supportTicket.userId, actor.user.id));
  return db.select().from(schema.supportTicket).where(and(...conds)).orderBy(desc(schema.supportTicket.updatedAt)).limit(100);
}

export async function getTicket(actor: Actor, ticketId: string) {
  const tickets = await listTickets(actor);
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new DomainError("not_found", "Demande introuvable");
  const messages = await db
    .select({ message: schema.supportMessage, author: schema.user.name })
    .from(schema.supportMessage)
    .leftJoin(schema.user, eq(schema.user.id, schema.supportMessage.authorId))
    .where(eq(schema.supportMessage.ticketId, ticket.id))
    .orderBy(asc(schema.supportMessage.createdAt));
  return { ticket, messages };
}

export async function replyTicket(actor: Actor, ticketId: string, body: string) {
  const { ticket } = await getTicket(actor, ticketId);
  const b = body.trim().slice(0, 5000);
  if (!b) throw new DomainError("invalid", "Message vide.");
  await db.insert(schema.supportMessage).values({ id: newId(), ticketId: ticket.id, authorId: actor.user.id, body: b });
  await db.update(schema.supportTicket).set({ status: "open", updatedAt: new Date() }).where(eq(schema.supportTicket.id, ticket.id));
}

// ---------------------------------------------------------------------------
// Plateforme
// ---------------------------------------------------------------------------

export async function staffListTickets(staff: Staff, status?: string) {
  if (!platformCan(staff.platformRole, "platform.support.respond")) throw new DomainError("forbidden", "Accès réservé.");
  return db
    .select({ ticket: schema.supportTicket, orgName: schema.organization.name, userEmail: schema.user.email })
    .from(schema.supportTicket)
    .leftJoin(schema.organization, eq(schema.organization.id, schema.supportTicket.organizationId))
    .leftJoin(schema.user, eq(schema.user.id, schema.supportTicket.userId))
    .where(status ? eq(schema.supportTicket.status, status) : undefined)
    .orderBy(desc(schema.supportTicket.updatedAt))
    .limit(200);
}

export async function staffGetTicket(staff: Staff, ticketId: string) {
  if (!platformCan(staff.platformRole, "platform.support.respond")) throw new DomainError("forbidden", "Accès réservé.");
  const [ticket] = await db.select().from(schema.supportTicket).where(eq(schema.supportTicket.id, ticketId));
  if (!ticket) throw new DomainError("not_found", "Ticket introuvable");
  const messages = await db
    .select({ message: schema.supportMessage, author: schema.user.name })
    .from(schema.supportMessage)
    .leftJoin(schema.user, eq(schema.user.id, schema.supportMessage.authorId))
    .where(eq(schema.supportMessage.ticketId, ticket.id))
    .orderBy(asc(schema.supportMessage.createdAt));
  return { ticket, messages };
}

export async function staffReply(staff: Staff, ticketId: string, body: string, close = false) {
  const { ticket } = await staffGetTicket(staff, ticketId);
  await db.insert(schema.supportMessage).values({ id: newId(), ticketId: ticket.id, authorId: staff.id, fromPlatform: true, body: body.trim().slice(0, 5000) });
  await db.update(schema.supportTicket).set({ status: close ? "closed" : "pending", updatedAt: new Date() }).where(eq(schema.supportTicket.id, ticket.id));
  if (ticket.userId) {
    const [u] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, ticket.userId));
    if (u) await sendEmail({ to: u.email, template: "supportReply", email: templates.supportReply({ subject: ticket.subject, url: `${appUrl()}/app/assistance/${ticket.id}` }) });
  }
  await audit({ organizationId: ticket.organizationId, actorUserId: staff.id, actorType: "staff", action: "support.reply", targetId: ticket.id });
}

/**
 * Accès d'assistance : explicite (motif obligatoire), limité (24 h max), visible et
 * révocable par le propriétaire, notifié par email, et journalisé.
 */
export async function grantSupportAccess(staff: Staff, organizationId: string, reason: string, hours: number) {
  if (!platformCan(staff.platformRole, "platform.support.access")) throw new DomainError("forbidden", "Accès réservé.");
  const r = reason.trim().slice(0, 300);
  if (r.length < 10) throw new DomainError("invalid", "Motif obligatoire (10 caractères minimum).");
  const duration = Math.min(Math.max(1, Math.floor(hours)), 24);
  const [org] = await db.select().from(schema.organization).where(eq(schema.organization.id, organizationId));
  if (!org) throw new DomainError("not_found", "Organisation introuvable");
  const id = newId();
  const expiresAt = new Date(Date.now() + duration * 3600_000);
  await db.insert(schema.supportAccessGrant).values({ id, organizationId, staffUserId: staff.id, reason: r, expiresAt });
  await audit({ organizationId, actorUserId: staff.id, actorType: "staff", action: "support.access_granted", targetId: id, metadata: { reason: r, hours: duration }, supportGrantId: id });
  const [staffUser] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, staff.id));
  const ownerRows = await db.select({ email: schema.user.email }).from(schema.membership).innerJoin(schema.user, eq(schema.user.id, schema.membership.userId)).where(and(eq(schema.membership.organizationId, organizationId), eq(schema.membership.role, "owner")));
  for (const o of ownerRows) {
    await sendEmail({ to: o.email, template: "supportAccessGranted", email: templates.supportAccessGranted({ orgName: org.name, staff: staffUser?.name ?? "L'équipe", reason: r, until: formatDateTime(expiresAt), url: `${appUrl()}/app/assistance` }) });
  }
  return { id, expiresAt };
}

export async function listActiveGrants(organizationId: string) {
  return db
    .select({ grant: schema.supportAccessGrant, staffName: schema.user.name })
    .from(schema.supportAccessGrant)
    .innerJoin(schema.user, eq(schema.user.id, schema.supportAccessGrant.staffUserId))
    .where(and(eq(schema.supportAccessGrant.organizationId, organizationId), isNull(schema.supportAccessGrant.revokedAt), gt(schema.supportAccessGrant.expiresAt, new Date())));
}

/** Le propriétaire (ou un gestionnaire) peut révoquer à tout moment un accès d'assistance. */
export async function revokeGrantByOrg(actor: Actor, grantId: string) {
  if (!can(actor, "members.manage") || actor.supportGrantId) throw new DomainError("forbidden", "Action réservée.");
  const updated = await db
    .update(schema.supportAccessGrant)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.supportAccessGrant.id, grantId), eq(schema.supportAccessGrant.organizationId, actor.organization.id)))
    .returning({ id: schema.supportAccessGrant.id });
  if (!updated.length) throw new DomainError("not_found", "Accès introuvable");
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "support.access_revoked", targetId: grantId });
}
