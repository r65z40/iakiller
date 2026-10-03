import type Stripe from "stripe";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { can, platformCan } from "@/lib/permissions";
import { appUrl } from "@/lib/config";
import { sendEmail } from "@/lib/email/send";
import { templates } from "@/lib/email/templates";
import { createCard, type Actor } from "@/lib/cards/service";
import { getStripe } from "@/lib/billing/stripe";

/**
 * Création accompagnée : prestation ponctuelle payée séparément.
 * Le paiement d'une prestation N'ACCORDE AUCUN droit d'abonnement : la publication de la
 * carte livrée reste soumise à un essai ou un abonnement actif, et à la validation du client.
 */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  requested: "Demande créée",
  awaiting_payment: "En attente de paiement",
  brief_received: "Brief reçu",
  in_progress: "Réalisation en cours",
  client_review: "À valider par vous",
  revisions: "Corrections demandées",
  delivered: "Livrée",
  closed: "Clôturée",
  cancelled: "Annulée",
};

const STAFF_TRANSITIONS: Record<string, string[]> = {
  brief_received: ["in_progress", "cancelled"],
  in_progress: ["client_review"],
  revisions: ["client_review"],
  delivered: ["closed"],
  requested: ["cancelled"],
  awaiting_payment: ["cancelled"],
};

export interface BriefInput {
  activity: string;
  people: string;
  style: string;
  links: string;
  notes: string;
}

function cleanBrief(b: Partial<BriefInput>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ["activity", "people", "style", "links", "notes"] as const) out[k] = String(b[k] ?? "").trim().slice(0, 3000);
  return out;
}

async function notifyOrg(organizationId: string, status: string) {
  const owners = await db
    .select({ email: schema.user.email })
    .from(schema.membership)
    .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
    .where(and(eq(schema.membership.organizationId, organizationId), eq(schema.membership.role, "owner")));
  for (const o of owners) {
    await sendEmail({ to: o.email, template: "serviceOrderUpdate", email: templates.serviceOrderUpdate({ status: ORDER_STATUS_LABELS[status] ?? status, url: `${appUrl()}/app/prestations` }) });
  }
}

export async function listActiveOffers() {
  return db.select().from(schema.serviceOffer).where(eq(schema.serviceOffer.isActive, true)).orderBy(asc(schema.serviceOffer.amountCents));
}

export async function listOrdersForOrg(actor: Actor) {
  if (!can(actor, "service.order")) throw new DomainError("forbidden", "Accès réservé.");
  return db
    .select({ order: schema.serviceOrder, offer: schema.serviceOffer })
    .from(schema.serviceOrder)
    .innerJoin(schema.serviceOffer, eq(schema.serviceOffer.id, schema.serviceOrder.offerId))
    .where(eq(schema.serviceOrder.organizationId, actor.organization.id))
    .orderBy(desc(schema.serviceOrder.createdAt));
}

export async function getOrderForOrg(actor: Actor, orderId: string) {
  if (!can(actor, "service.order")) throw new DomainError("forbidden", "Accès réservé.");
  const [row] = await db
    .select({ order: schema.serviceOrder, offer: schema.serviceOffer })
    .from(schema.serviceOrder)
    .innerJoin(schema.serviceOffer, eq(schema.serviceOffer.id, schema.serviceOrder.offerId))
    .where(and(eq(schema.serviceOrder.id, orderId), eq(schema.serviceOrder.organizationId, actor.organization.id)));
  if (!row) throw new DomainError("not_found", "Demande introuvable");
  return row;
}

export async function createServiceOrder(actor: Actor, offerId: string, brief: Partial<BriefInput>) {
  if (!can(actor, "service.order")) throw new DomainError("forbidden", "Seuls le propriétaire et les responsables facturation peuvent commander.");
  const [offer] = await db.select().from(schema.serviceOffer).where(and(eq(schema.serviceOffer.id, offerId), eq(schema.serviceOffer.isActive, true)));
  if (!offer) throw new DomainError("not_found", "Prestation introuvable");
  const b = cleanBrief(brief);
  if (b.activity.length < 10) throw new DomainError("invalid", "Décrivez votre activité en quelques phrases (10 caractères minimum).");
  const id = newId();
  await db.insert(schema.serviceOrder).values({
    id,
    organizationId: actor.organization.id,
    offerId: offer.id,
    status: "requested",
    amountCents: offer.amountCents,
    currency: offer.currency,
    brief: b,
    includedRevisions: offer.includedRevisions,
    requestedById: actor.user.id,
  });
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "service.order_create", targetType: "service_order", targetId: id });
  return { id };
}

/** Lien de paiement généré côté serveur, montant issu de la base (jamais du navigateur). */
export async function startServicePayment(actor: Actor, orderId: string, ensureCustomer: (orgId: string) => Promise<string>) {
  const { order, offer } = await getOrderForOrg(actor, orderId);
  if (order.status !== "requested" && order.status !== "awaiting_payment") throw new DomainError("invalid", "Cette demande n'est plus en attente de paiement.");
  const stripe = getStripe();
  if (!stripe) throw new DomainError("not_configured", "Le paiement en ligne n'est pas encore configuré (mode local). Aucun paiement ne peut être effectué.");
  if (offer.isDemo || !offer.stripePriceId) throw new DomainError("not_configured", "Tarif de démonstration : la prestation n'est pas encore commercialisée.");
  const customer = await ensureCustomer(actor.organization.id);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer,
    line_items: [{ price: offer.stripePriceId, quantity: 1 }],
    client_reference_id: actor.organization.id,
    metadata: { kind: "service_order", orderId: order.id, orgId: actor.organization.id },
    payment_intent_data: { metadata: { kind: "service_order", orderId: order.id, orgId: actor.organization.id } },
    invoice_creation: { enabled: true },
    success_url: `${appUrl()}/app/prestations/${order.id}?retour=paiement`,
    cancel_url: `${appUrl()}/app/prestations/${order.id}`,
    locale: "fr",
  });
  await db.update(schema.serviceOrder).set({ status: "awaiting_payment", stripeCheckoutSessionId: session.id, updatedAt: new Date() }).where(eq(schema.serviceOrder.id, order.id));
  return session.url!;
}

/**
 * Appelé par le webhook (jamais par la page de retour). Vérifie la cohérence complète
 * entre la session Stripe et la commande avant de la marquer payée.
 */
export async function markServiceOrderPaid(session: Stripe.Checkout.Session): Promise<string | null> {
  const orderId = session.metadata?.orderId;
  if (!orderId) return null;
  const [order] = await db.select().from(schema.serviceOrder).where(eq(schema.serviceOrder.id, orderId));
  if (!order) return null;
  if (order.organizationId !== session.metadata?.orgId) return null;
  if (order.stripeCheckoutSessionId !== session.id) return null;
  if (session.amount_total !== order.amountCents || session.currency !== order.currency) return null;
  if (order.paidAt) return order.organizationId; // déjà traité
  await db.update(schema.serviceOrder).set({ status: "brief_received", paidAt: new Date(), updatedAt: new Date() }).where(eq(schema.serviceOrder.id, order.id));
  await audit({ organizationId: order.organizationId, actorType: "stripe", action: "service.order_paid", targetType: "service_order", targetId: order.id, metadata: { amount: order.amountCents } });
  await notifyOrg(order.organizationId, "brief_received");
  return order.organizationId;
}

export async function addOrderMessage(actor: Actor, orderId: string, body: string) {
  const { order } = await getOrderForOrg(actor, orderId);
  const text = body.trim().slice(0, 4000);
  if (!text) throw new DomainError("invalid", "Message vide.");
  await db.insert(schema.serviceOrderMessage).values({ id: newId(), orderId: order.id, organizationId: order.organizationId, authorId: actor.user.id, fromPlatform: false, body: text });
}

export async function listOrderMessages(orderId: string, organizationId: string) {
  return db
    .select({ message: schema.serviceOrderMessage, author: schema.user.name })
    .from(schema.serviceOrderMessage)
    .leftJoin(schema.user, eq(schema.user.id, schema.serviceOrderMessage.authorId))
    .where(and(eq(schema.serviceOrderMessage.orderId, orderId), eq(schema.serviceOrderMessage.organizationId, organizationId)))
    .orderBy(asc(schema.serviceOrderMessage.createdAt));
}

/** Le client valide la livraison : la commande passe en « livrée ». La publication reste un acte séparé. */
export async function approveDelivery(actor: Actor, orderId: string) {
  const { order } = await getOrderForOrg(actor, orderId);
  if (order.status !== "client_review") throw new DomainError("invalid", "Rien à valider pour le moment.");
  await db.update(schema.serviceOrder).set({ status: "delivered", updatedAt: new Date() }).where(eq(schema.serviceOrder.id, order.id));
  await revokeOrderGrants(order.id);
  await audit({ organizationId: order.organizationId, actorUserId: actor.user.id, actorType: "user", action: "service.delivery_approved", targetType: "service_order", targetId: order.id });
}

export async function requestRevision(actor: Actor, orderId: string, message: string) {
  const { order } = await getOrderForOrg(actor, orderId);
  if (order.status !== "client_review") throw new DomainError("invalid", "Les corrections se demandent pendant la phase de validation.");
  if (order.revisionsUsed >= order.includedRevisions) {
    throw new DomainError("invalid", "Les corrections incluses ont été utilisées. Écrivez-nous via la messagerie pour convenir de la suite.");
  }
  await db.transaction(async (tx) => {
    await tx.update(schema.serviceOrder).set({ status: "revisions", revisionsUsed: order.revisionsUsed + 1, updatedAt: new Date() }).where(eq(schema.serviceOrder.id, order.id));
    await tx.insert(schema.serviceOrderMessage).values({ id: newId(), orderId: order.id, organizationId: order.organizationId, authorId: actor.user.id, body: `Demande de correction : ${message.trim().slice(0, 4000)}` });
  });
}

export async function requestRefund(actor: Actor, orderId: string, note: string) {
  const { order } = await getOrderForOrg(actor, orderId);
  if (!order.paidAt) throw new DomainError("invalid", "Aucun paiement à rembourser.");
  await db.update(schema.serviceOrder).set({ refundRequestedAt: new Date(), refundNote: note.trim().slice(0, 2000), updatedAt: new Date() }).where(eq(schema.serviceOrder.id, order.id));
  await audit({ organizationId: order.organizationId, actorUserId: actor.user.id, actorType: "user", action: "service.refund_requested", targetType: "service_order", targetId: order.id });
}

// ---------------------------------------------------------------------------
// Côté plateforme
// ---------------------------------------------------------------------------

export interface Staff {
  id: string;
  platformRole: string | null;
}

function assertStaff(staff: Staff) {
  if (!platformCan(staff.platformRole, "platform.service.manage")) throw new DomainError("forbidden", "Accès réservé à l'équipe.");
}

export async function staffSetOrderStatus(staff: Staff, orderId: string, status: string) {
  assertStaff(staff);
  const [order] = await db.select().from(schema.serviceOrder).where(eq(schema.serviceOrder.id, orderId));
  if (!order) throw new DomainError("not_found", "Commande introuvable");
  if (!STAFF_TRANSITIONS[order.status]?.includes(status)) throw new DomainError("invalid", `Transition impossible : ${order.status} → ${status}`);
  if (status === "client_review" && !order.cardId) throw new DomainError("invalid", "Créez d'abord le brouillon de carte du client.");
  await db.update(schema.serviceOrder).set({ status, updatedAt: new Date(), assignedToId: order.assignedToId ?? staff.id }).where(eq(schema.serviceOrder.id, order.id));
  if (status === "closed" || status === "cancelled") await revokeOrderGrants(order.id);
  await audit({ organizationId: order.organizationId, actorUserId: staff.id, actorType: "staff", action: "service.status", targetType: "service_order", targetId: order.id, metadata: { from: order.status, to: status } });
  await notifyOrg(order.organizationId, status);
}

export async function staffAddOrderMessage(staff: Staff, orderId: string, body: string) {
  assertStaff(staff);
  const [order] = await db.select().from(schema.serviceOrder).where(eq(schema.serviceOrder.id, orderId));
  if (!order) throw new DomainError("not_found", "Commande introuvable");
  await db.insert(schema.serviceOrderMessage).values({ id: newId(), orderId: order.id, organizationId: order.organizationId, authorId: staff.id, fromPlatform: true, body: body.trim().slice(0, 4000) });
}

/**
 * Le prestataire crée un BROUILLON dans l'organisation du client via un accès d'assistance
 * dédié, limité dans le temps et journalisé. Aucun mot de passe client n'est demandé.
 */
export async function staffCreateDraftForOrder(staff: Staff, orderId: string) {
  assertStaff(staff);
  const [order] = await db.select().from(schema.serviceOrder).where(eq(schema.serviceOrder.id, orderId));
  if (!order) throw new DomainError("not_found", "Commande introuvable");
  if (!order.paidAt) throw new DomainError("invalid", "La commande n'est pas payée.");
  if (order.cardId) return { cardId: order.cardId };
  const grantId = newId();
  await db.insert(schema.supportAccessGrant).values({
    id: grantId,
    organizationId: order.organizationId,
    staffUserId: staff.id,
    reason: `Création accompagnée (commande ${order.id})`,
    serviceOrderId: order.id,
    expiresAt: new Date(Date.now() + 30 * 86400_000),
  });
  const actor: Actor = { user: { id: staff.id }, organization: { id: order.organizationId }, role: "manager", canManageBilling: false, supportGrantId: grantId };
  const brief = order.brief as Record<string, string>;
  const card = await createCard(actor, { title: `Création accompagnée – ${(brief.people || "carte").slice(0, 40)}` });
  await db.update(schema.serviceOrder).set({ cardId: card.id, status: order.status === "brief_received" ? "in_progress" : order.status, assignedToId: staff.id, updatedAt: new Date() }).where(eq(schema.serviceOrder.id, order.id));
  await audit({ organizationId: order.organizationId, actorUserId: staff.id, actorType: "staff", action: "service.draft_created", targetType: "card", targetId: card.id, supportGrantId: grantId });
  return { cardId: card.id, grantId };
}

/** Fin des droits d'assistance liés à la commande (remise à zéro après livraison). */
export async function revokeOrderGrants(orderId: string) {
  await db
    .update(schema.supportAccessGrant)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.supportAccessGrant.serviceOrderId, orderId), isNull(schema.supportAccessGrant.revokedAt)));
}
