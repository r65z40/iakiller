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
import { STAGE_IDS, STAGE_LABELS } from "./crm";

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
  /** Réponses aux champs sur mesure, transmises sous la forme `cf_<id>`. */
  [key: string]: unknown;
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

  // Champs sur mesure : on ne conserve que ceux définis sur la carte, avec leur libellé courant.
  const extra: { label: string; value: string }[] = [];
  for (const f of form.customFields) {
    const raw = str(input[`cf_${f.id}`], f.type === "textarea" ? 2000 : 254);
    if (!raw) {
      if (f.required) return { ok: false, status: 400, error: "Merci de remplir les champs obligatoires." };
      continue;
    }
    if (f.type === "email" && !isValidEmail(raw.toLowerCase())) return { ok: false, status: 400, error: `Adresse email invalide pour « ${f.label} ».` };
    if (f.type === "tel" && !normalizePhone(raw)) return { ok: false, status: 400, error: `Numéro invalide pour « ${f.label} ».` };
    if (f.type === "select" && !f.options.includes(raw)) return { ok: false, status: 400, error: `Choix invalide pour « ${f.label} ».` };
    extra.push({ label: f.label.slice(0, 60), value: raw });
  }

  const dedupeHash = sha256([card.id, values.email, values.phone, values.message].join("|"));
  const since = new Date(now.getTime() - 24 * 3600_000);
  const [dup] = await db.select({ id: schema.lead.id }).from(schema.lead).where(and(eq(schema.lead.dedupeHash, dedupeHash), gte(schema.lead.createdAt, since))).limit(1);
  if (dup) return { ok: true }; // doublon (double clic, renvoi) : pas de nouvelle entrée

  const [daily] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.lead).where(and(eq(schema.lead.cardId, card.id), gte(schema.lead.createdAt, since)));
  if ((daily?.n ?? 0) >= PER_CARD_DAILY) return { ok: false, status: 429, error: "Le formulaire est momentanément indisponible. Réessayez plus tard." };

  // Photos jointes : seulement si le formulaire les autorise, et on ne garde que des médias
  // « lead » réellement rattachés à cette organisation (aucune référence arbitraire).
  let photoIds: string[] = [];
  if (form.allowPhotos && Array.isArray(input.photoIds)) {
    const wanted = input.photoIds.filter((v): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{4,40}$/.test(v)).slice(0, form.maxPhotos);
    if (wanted.length) {
      const rows = await db
        .select({ id: schema.mediaAsset.id })
        .from(schema.mediaAsset)
        .where(and(inArray(schema.mediaAsset.id, wanted), eq(schema.mediaAsset.organizationId, card.organizationId), eq(schema.mediaAsset.source, "lead")));
      const ok = new Set(rows.map((r) => r.id));
      photoIds = wanted.filter((v) => ok.has(v));
    }
  }

  // Source précise : qr / campagne / direct, avec le détail (slug de variante de QR ou campagne utm).
  const rawSource = typeof input.source === "string" ? input.source : "direct";
  const source = rawSource === "qr" ? "qr" : rawSource === "campaign" ? "campaign" : "direct";
  const sourceDetail = str(input.utmCampaign, 60) || null;

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
    extra: extra.length ? extra : null,
    photoIds: photoIds.length ? photoIds : null,
    source,
    sourceDetail,
    marketingConsent: input.marketingConsent === true,
    dedupeHash,
  });
  await db.insert(schema.leadActivity).values({ id: newId(), leadId: id, organizationId: card.organizationId, kind: "created", text: "Demande reçue", actorId: null });

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
  // Destinataires supplémentaires choisis sur la carte (emails valides uniquement).
  const custom = form.notifyEmails.map((e) => e.trim().toLowerCase()).filter((e) => isValidEmail(e));
  // Limite les notifications par carte (anti-inondation des boîtes mail d'une organisation) :
  // le prospect est toujours enregistré, mais au-delà on n'envoie plus d'email.
  const recipients =
    rateLimit(`leadnotif:${card.id}`, 10, 3600_000, now.getTime())
      ? [...new Set([...assignees, ...managers].map((r) => r.email).concat(custom))].slice(0, 25)
      : [];
  // Sur demande explicite (par carte), le détail accompagne la notification ; sinon lien vers l'espace.
  const email = form.includeContentInEmail
    ? templates.leadReceivedDetailed({
        cardTitle: card.title,
        url: `${appUrl()}/app/prospects`,
        name: values.name,
        email: values.email,
        phone: values.phone,
        company: values.company,
        message: values.message,
        extra,
      })
    : templates.leadReceived({ cardTitle: card.title, url: `${appUrl()}/app/prospects` });
  for (const to of recipients) {
    await sendEmail({ to, template: form.includeContentInEmail ? "leadReceivedDetailed" : "leadReceived", email });
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

export async function listLeads(actor: Actor, opts: { stage?: string; cardId?: string; limit?: number; offset?: number } = {}) {
  const scope = await leadScope(actor);
  if (!scope) return [];
  const conditions = [scope];
  if (opts.stage && STAGE_IDS.includes(opts.stage)) conditions.push(eq(schema.lead.stage, opts.stage));
  if (opts.cardId) conditions.push(eq(schema.lead.cardId, opts.cardId));
  return db
    .select({ lead: schema.lead, cardTitle: schema.card.title, assigneeName: schema.user.name })
    .from(schema.lead)
    .leftJoin(schema.card, eq(schema.card.id, schema.lead.cardId))
    .leftJoin(schema.user, eq(schema.user.id, schema.lead.assignedToId))
    .where(and(...conditions))
    .orderBy(desc(schema.lead.createdAt))
    .limit(Math.min(opts.limit ?? 500, 1000))
    .offset(opts.offset ?? 0);
}

/** Une fiche prospect complète (scopée) avec le nom du responsable et le titre de la carte. */
export async function getLeadForActor(actor: Actor, leadId: string) {
  const scope = await leadScope(actor);
  if (!scope) throw new DomainError("not_found", "Prospect introuvable");
  const [row] = await db
    .select({ lead: schema.lead, cardTitle: schema.card.title, assigneeName: schema.user.name })
    .from(schema.lead)
    .leftJoin(schema.card, eq(schema.card.id, schema.lead.cardId))
    .leftJoin(schema.user, eq(schema.user.id, schema.lead.assignedToId))
    .where(and(eq(schema.lead.id, leadId), scope));
  if (!row) throw new DomainError("not_found", "Prospect introuvable");
  return row;
}

/** Création manuelle d'un prospect (saisie à la main par un gestionnaire). */
export async function createManualLead(
  actor: Actor,
  input: { name?: string; email?: string; phone?: string; company?: string; message?: string; stage?: string },
) {
  if (!can(actor, "leads.viewAll")) throw new DomainError("forbidden", "Action réservée aux gestionnaires.");
  const name = str(input.name, 120);
  const email = str(input.email, 254);
  const phone = normalizePhone(str(input.phone, 40));
  const company = str(input.company, 120);
  const message = str(input.message, 2000);
  if (!name && !email && !phone) throw new DomainError("invalid", "Renseignez au moins un nom, un email ou un téléphone.");
  const stage = input.stage && STAGE_IDS.includes(input.stage) ? input.stage : "nouveau";
  const id = newId();
  await db.insert(schema.lead).values({
    id,
    organizationId: actor.organization.id,
    cardId: null,
    name: name || null,
    email: email || null,
    phone: phone || null,
    company: company || null,
    message: message || null,
    marketingConsent: false,
    stage,
    source: "manual",
    dedupeHash: `manual:${id}`,
  });
  await db.insert(schema.leadActivity).values({ id: newId(), leadId: id, organizationId: actor.organization.id, kind: "created", text: "Prospect créé manuellement", actorId: actor.user.id });
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "lead.create", targetId: id });
  return id;
}

/** Membres pouvant être désignés responsables d'un prospect (réservé aux gestionnaires). */
export async function listAssignableMembers(actor: Actor) {
  if (!can(actor, "leads.viewAll")) return [];
  return db
    .select({ id: schema.user.id, name: schema.user.name })
    .from(schema.membership)
    .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
    .where(eq(schema.membership.organizationId, actor.organization.id))
    .orderBy(schema.user.name);
}

export async function updateLead(
  actor: Actor,
  leadId: string,
  patch: { stage?: string; notes?: string; tags?: string[]; assignedToId?: string | null },
) {
  const scope = await leadScope(actor);
  if (!scope) throw new DomainError("not_found", "Prospect introuvable");
  const [before] = await db.select().from(schema.lead).where(and(eq(schema.lead.id, leadId), scope));
  if (!before) throw new DomainError("not_found", "Prospect introuvable");

  const set: Partial<typeof schema.lead.$inferInsert> = { updatedAt: new Date() };
  const activities: { kind: string; text: string }[] = [];

  if (patch.stage !== undefined) {
    if (!STAGE_IDS.includes(patch.stage)) throw new DomainError("invalid", "Étape invalide.");
    set.stage = patch.stage;
    if (patch.stage !== before.stage) activities.push({ kind: "stage", text: `Étape : ${STAGE_LABELS[patch.stage] ?? patch.stage}` });
  }
  if (patch.notes !== undefined) set.notes = patch.notes.slice(0, 4000);
  if (patch.tags !== undefined) {
    set.tags = [...new Set(patch.tags.map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 20);
  }
  if (patch.assignedToId !== undefined) {
    let assignedToId: string | null = null;
    if (patch.assignedToId) {
      const [m] = await db
        .select({ id: schema.membership.userId, name: schema.user.name })
        .from(schema.membership)
        .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
        .where(and(eq(schema.membership.organizationId, actor.organization.id), eq(schema.membership.userId, patch.assignedToId)));
      if (!m) throw new DomainError("invalid", "Responsable invalide.");
      assignedToId = m.id;
      if (assignedToId !== before.assignedToId) activities.push({ kind: "assign", text: `Responsable : ${m.name}` });
    } else if (before.assignedToId) {
      activities.push({ kind: "assign", text: "Responsable retiré" });
    }
    set.assignedToId = assignedToId;
  }

  await db.update(schema.lead).set(set).where(and(eq(schema.lead.id, leadId), scope));
  for (const a of activities) {
    await db.insert(schema.leadActivity).values({ id: newId(), leadId, organizationId: actor.organization.id, kind: a.kind, text: a.text, actorId: actor.user.id });
  }
}

/** Historique d'un prospect (plus récent d'abord). */
export async function listLeadActivity(actor: Actor, leadId: string) {
  await getLeadForActor(actor, leadId); // contrôle d'accès
  return db
    .select({ activity: schema.leadActivity, actorName: schema.user.name })
    .from(schema.leadActivity)
    .leftJoin(schema.user, eq(schema.user.id, schema.leadActivity.actorId))
    .where(eq(schema.leadActivity.leadId, leadId))
    .orderBy(desc(schema.leadActivity.createdAt))
    .limit(100);
}

export async function listLeadTasks(actor: Actor, leadId: string) {
  await getLeadForActor(actor, leadId);
  return db.select().from(schema.leadTask).where(eq(schema.leadTask.leadId, leadId)).orderBy(schema.leadTask.doneAt, schema.leadTask.dueAt);
}

export async function addLeadTask(actor: Actor, leadId: string, input: { title: string; dueAt?: string | null }) {
  await getLeadForActor(actor, leadId);
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new DomainError("invalid", "Donnez un intitulé à la tâche.");
  const due = input.dueAt ? new Date(input.dueAt) : null;
  if (due && Number.isNaN(due.getTime())) throw new DomainError("invalid", "Échéance invalide.");
  const id = newId();
  await db.insert(schema.leadTask).values({ id, leadId, organizationId: actor.organization.id, title, dueAt: due, createdById: actor.user.id });
  await db.insert(schema.leadActivity).values({ id: newId(), leadId, organizationId: actor.organization.id, kind: "task", text: `Tâche ajoutée : ${title}`, actorId: actor.user.id });
  return id;
}

export async function setLeadTaskDone(actor: Actor, taskId: string, done: boolean) {
  const [task] = await db
    .select()
    .from(schema.leadTask)
    .where(and(eq(schema.leadTask.id, taskId), eq(schema.leadTask.organizationId, actor.organization.id)));
  if (!task) throw new DomainError("not_found", "Tâche introuvable");
  await getLeadForActor(actor, task.leadId); // contrôle d'accès au prospect
  await db.update(schema.leadTask).set({ doneAt: done ? new Date() : null }).where(eq(schema.leadTask.id, taskId));
}

export async function deleteLeadTask(actor: Actor, taskId: string) {
  const [task] = await db
    .select()
    .from(schema.leadTask)
    .where(and(eq(schema.leadTask.id, taskId), eq(schema.leadTask.organizationId, actor.organization.id)));
  if (!task) throw new DomainError("not_found", "Tâche introuvable");
  await getLeadForActor(actor, task.leadId);
  await db.delete(schema.leadTask).where(eq(schema.leadTask.id, taskId));
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
    ["Date (UTC)", "Carte", "Nom", "Email", "Téléphone", "Société", "Message", "Champs sur mesure", "Photos", "Source", "Étape", "Responsable", "Accord marketing", "Notes"],
    all.map(({ lead, cardTitle, assigneeName }) => [
      lead.createdAt.toISOString(),
      cardTitle ?? "",
      lead.name,
      lead.email,
      lead.phone,
      lead.company,
      lead.message,
      (lead.extra ?? []).map((e) => `${e.label}: ${e.value}`).join(" | "),
      (lead.photoIds ?? []).length,
      lead.sourceDetail ? `${lead.source} (${lead.sourceDetail})` : lead.source,
      STAGE_LABELS[lead.stage] ?? lead.stage,
      assigneeName ?? "",
      lead.marketingConsent ? "oui" : "non",
      lead.notes,
    ]),
  );
}
