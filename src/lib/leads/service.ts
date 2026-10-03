import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId, sha256 } from "@/lib/ids";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/config";
import { can } from "@/lib/permissions";
import { isValidEmail, normalizePhone } from "@/lib/validation/urls";
import { checkLeadFormToken } from "@/lib/security/signed";
import { rateLimit } from "@/lib/security/rate-limit";
import { isCardPubliclyAccessible } from "@/lib/cards/public";
import { parseDocument } from "@/lib/cards/document";
import { sendEmail } from "@/lib/email/send";
import { templates } from "@/lib/email/templates";
import type { Actor } from "@/lib/cards/service";

export interface LeadInput {
  token?: unknown;
  formToken?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  message?: unknown;
  website?: unknown; // champ piège
  marketingConsent?: unknown;
}

export type LeadResult = { ok: true } | { ok: false; status: number; error: string };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Nombre maximal de demandes par carte et par jour (anti-abus). */
const PER_CARD_DAILY = 100;

export async function submitLead(input: LeadInput, meta: { ipKey: string; now?: Date }): Promise<LeadResult> {
  const now = meta.now ?? new Date();
  if (typeof input.token !== "string" || !/^[A-Za-z0-9_-]{10,64}$/.test(input.token)) return { ok: false, status: 400, error: "Formulaire invalide." };
  if (!rateLimit(`lead:ip:${meta.ipKey}`, 5, 10 * 60_000, now.getTime())) {
    return { ok: false, status: 429, error: "Trop d'envois depuis votre connexion. Réessayez dans quelques minutes." };
  }

  const [card] = await db.select().from(schema.card).where(eq(schema.card.publicToken, input.token));
  if (!card || !(await isCardPubliclyAccessible(card, now))) return { ok: false, status: 404, error: "Cette carte n'est plus disponible." };
  const [version] = await db.select().from(schema.cardVersion).where(eq(schema.cardVersion.id, card.publishedVersionId!));
  const parsed = version ? parseDocument(version.document) : null;
  const form = parsed?.success ? parsed.data.blocks.find((b) => b.type === "leadForm" && !b.hidden) : undefined;
  if (!form || form.type !== "leadForm") return { ok: false, status: 404, error: "Aucun formulaire sur cette carte." };

  // Robot : on répond comme si tout allait bien, sans rien enregistrer.
  if (str(input.website, 200)) return { ok: true };
  const tokenState = checkLeadFormToken(input.formToken, card.id, now.getTime());
  if (tokenState === "too_fast") return { ok: false, status: 400, error: "Envoi trop rapide. Patientez quelques secondes puis réessayez." };
  if (tokenState !== "ok") return { ok: false, status: 400, error: "Le formulaire a expiré. Rechargez la page." };

  const values = {
    name: form.fields.name === "off" ? "" : str(input.name, 120),
    email: form.fields.email === "off" ? "" : str(input.email, 254).toLowerCase(),
    phone: form.fields.phone === "off" ? "" : str(input.phone, 32),
    company: form.fields.company === "off" ? "" : str(input.company, 120),
    message: form.fields.message === "off" ? "" : str(input.message, 2000),
  };
  for (const [k, mode] of Object.entries(form.fields)) {
    if (mode === "required" && !values[k as keyof typeof values]) return { ok: false, status: 400, error: "Merci de remplir les champs obligatoires." };
  }
  if (!values.email && !values.phone) return { ok: false, status: 400, error: "Indiquez au moins un email ou un téléphone pour être recontacté." };
  if (values.email && !isValidEmail(values.email)) return { ok: false, status: 400, error: "Adresse email invalide." };
  if (values.phone && !normalizePhone(values.phone)) return { ok: false, status: 400, error: "Numéro de téléphone invalide." };

  const dedupeHash = sha256([card.id, values.email, values.phone, values.message].join("|"));
  const since = new Date(now.getTime() - 24 * 3600_000);
  const [dup] = await db.select({ id: schema.lead.id }).from(schema.lead).where(and(eq(schema.lead.dedupeHash, dedupeHash), gte(schema.lead.createdAt, since))).limit(1);
  if (dup) return { ok: true }; // doublon (double clic, renvoi) : pas de nouvelle entrée

  const [daily] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.lead).where(and(eq(schema.lead.cardId, card.id), gte(schema.lead.createdAt, since)));
  if ((daily?.n ?? 0) >= PER_CARD_DAILY) return { ok: false, status: 429, error: "Le formulaire est momentanément indisponible. Réessayez plus tard." };

  const id = newId();
  await db.insert(schema.lead).values({
    id,
    organizationId: card.organizationId,
    cardId: card.id,
    name: values.name || null,
    email: values.email || null,
    phone: values.phone || null,
    company: values.company || null,
    message: values.message || null,
    marketingConsent: input.marketingConsent === true,
    dedupeHash,
  });

  // Notification sans le contenu de la demande (consultable uniquement dans l'espace).
  const assignees = await db
    .select({ email: schema.user.email })
    .from(schema.cardAssignment)
    .innerJoin(schema.user, eq(schema.user.id, schema.cardAssignment.userId))
    .where(eq(schema.cardAssignment.cardId, card.id));
  const managers = await db
    .select({ email: schema.user.email })
    .from(schema.membership)
    .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
    .where(and(eq(schema.membership.organizationId, card.organizationId), inArray(schema.membership.role, ["owner", "manager"])));
  // Limite les notifications par carte (anti-inondation des boîtes mail d'une organisation) :
  // le prospect est toujours enregistré, mais au-delà on n'envoie plus d'email.
  const recipients =
    rateLimit(`leadnotif:${card.id}`, 10, 3600_000, now.getTime())
      ? [...new Set([...assignees, ...managers].map((r) => r.email))].slice(0, 20)
      : [];
  for (const to of recipients) {
    await sendEmail({ to, template: "leadReceived", email: templates.leadReceived({ cardTitle: card.title, url: `${appUrl()}/app/prospects` }) });
  }
  return { ok: true };
}

async function assignedCardIds(actor: Actor) {
  const rows = await db.select({ id: schema.cardAssignment.cardId }).from(schema.cardAssignment).where(and(eq(schema.cardAssignment.userId, actor.user.id), eq(schema.cardAssignment.organizationId, actor.organization.id)));
  return rows.map((r) => r.id);
}

/** Visibilité : toute l'organisation pour propriétaire/gestionnaire, cartes assignées pour un collaborateur. */
async function leadScope(actor: Actor) {
  const conditions = [eq(schema.lead.organizationId, actor.organization.id)];
  if (!can(actor, "leads.viewAll")) {
    const ids = await assignedCardIds(actor);
    if (ids.length === 0) return null;
    conditions.push(inArray(schema.lead.cardId, ids));
  }
  return and(...conditions);
}

export async function listLeads(actor: Actor, opts: { status?: string; cardId?: string; limit?: number; offset?: number } = {}) {
  const scope = await leadScope(actor);
  if (!scope) return [];
  const conditions = [scope];
  if (opts.status && ["new", "contacted", "done"].includes(opts.status)) conditions.push(eq(schema.lead.status, opts.status));
  if (opts.cardId) conditions.push(eq(schema.lead.cardId, opts.cardId));
  return db
    .select({ lead: schema.lead, cardTitle: schema.card.title })
    .from(schema.lead)
    .leftJoin(schema.card, eq(schema.card.id, schema.lead.cardId))
    .where(and(...conditions))
    .orderBy(desc(schema.lead.createdAt))
    .limit(Math.min(opts.limit ?? 50, 200))
    .offset(opts.offset ?? 0);
}

export async function updateLead(actor: Actor, leadId: string, patch: { status?: string; notes?: string }) {
  const scope = await leadScope(actor);
  if (!scope) throw new DomainError("not_found", "Prospect introuvable");
  const set: Partial<typeof schema.lead.$inferInsert> = { updatedAt: new Date() };
  if (patch.status !== undefined) {
    if (!["new", "contacted", "done"].includes(patch.status)) throw new DomainError("invalid", "Statut invalide.");
    set.status = patch.status;
  }
  if (patch.notes !== undefined) set.notes = patch.notes.slice(0, 4000);
  const updated = await db.update(schema.lead).set(set).where(and(eq(schema.lead.id, leadId), scope)).returning({ id: schema.lead.id });
  if (updated.length === 0) throw new DomainError("not_found", "Prospect introuvable");
}

export async function deleteLead(actor: Actor, leadId: string) {
  if (!can(actor, "leads.viewAll")) throw new DomainError("forbidden", "Action réservée aux gestionnaires.");
  const deleted = await db.delete(schema.lead).where(and(eq(schema.lead.id, leadId), eq(schema.lead.organizationId, actor.organization.id))).returning({ id: schema.lead.id });
  if (deleted.length === 0) throw new DomainError("not_found", "Prospect introuvable");
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "lead.delete", targetId: leadId });
}

/**
 * Neutralise les cellules interprétables comme formules par un tableur
 * (=, +, -, @, tabulation, retour chariot) et échappe les guillemets.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM UTF-8 pour une ouverture correcte des accents dans Excel.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

export async function exportLeadsCsv(actor: Actor) {
  const rows = await listLeads(actor, { limit: 200 });
  const all = [...rows];
  for (let offset = 200; rows.length === 200 && offset < 20000; offset += 200) {
    const page = await listLeads(actor, { limit: 200, offset });
    all.push(...page);
    if (page.length < 200) break;
  }
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "lead.export", metadata: { count: all.length } });
  return toCsv(
    ["Date (UTC)", "Carte", "Nom", "Email", "Téléphone", "Société", "Message", "Accord marketing", "Statut", "Notes"],
    all.map(({ lead, cardTitle }) => [lead.createdAt.toISOString(), cardTitle ?? "", lead.name, lead.email, lead.phone, lead.company, lead.message, lead.marketingConsent ? "oui" : "non", lead.status, lead.notes]),
  );
}
