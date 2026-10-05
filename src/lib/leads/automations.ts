import { and, desc, eq, inArray, max, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { DomainError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { sendEmail } from "@/lib/email/send";
import { templates } from "@/lib/email/templates";
import type { Actor } from "@/lib/cards/service";
import { AUTOMATION_ACTION_IDS as ACTION_IDS, AUTOMATION_TRIGGER_IDS as TRIGGER_IDS, STAGE_IDS, STAGE_LABELS } from "./crm";

/** Étapes « fermées » : on ne relance jamais un prospect gagné ou perdu. */
const CLOSED = ["gagne", "perdu"];
const MAX_RULES = 50;

export interface AutomationInput {
  name?: unknown;
  trigger?: unknown;
  triggerStage?: unknown;
  delayHours?: unknown;
  action?: unknown;
  emailSubject?: unknown;
  emailBody?: unknown;
  taskTitle?: unknown;
}

function str(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function listAutomations(actor: Actor) {
  if (!can(actor, "leads.viewAll")) throw new DomainError("forbidden", "Accès réservé aux gestionnaires.");
  return db
    .select()
    .from(schema.leadAutomation)
    .where(eq(schema.leadAutomation.organizationId, actor.organization.id))
    .orderBy(desc(schema.leadAutomation.createdAt));
}

/** Valide et normalise une règle à partir d'une saisie libre. */
function parseInput(input: AutomationInput) {
  const name = str(input.name, 80);
  if (!name) throw new DomainError("invalid", "Donnez un nom à la règle.");
  const trigger = str(input.trigger, 20);
  if (!TRIGGER_IDS.includes(trigger)) throw new DomainError("invalid", "Déclencheur invalide.");
  const action = str(input.action, 20);
  if (!ACTION_IDS.includes(action)) throw new DomainError("invalid", "Action invalide.");

  let triggerStage: string | null = str(input.triggerStage, 30) || null;
  if (trigger === "stage_entered") {
    if (!triggerStage || !STAGE_IDS.includes(triggerStage)) throw new DomainError("invalid", "Choisissez une étape déclencheuse.");
  } else if (triggerStage && !STAGE_IDS.includes(triggerStage)) {
    triggerStage = null;
  }

  const delayHours = Math.min(Math.max(Math.round(Number(input.delayHours) || 24), 1), 8760);

  let emailSubject: string | null = null;
  let emailBody: string | null = null;
  let taskTitle: string | null = null;
  if (action === "email") {
    emailSubject = str(input.emailSubject, 150);
    emailBody = str(input.emailBody, 4000);
    if (!emailSubject || !emailBody) throw new DomainError("invalid", "Renseignez l'objet et le message de l'email.");
  } else {
    taskTitle = str(input.taskTitle, 200);
    if (!taskTitle) throw new DomainError("invalid", "Donnez un intitulé à la tâche.");
  }
  return { name, trigger, triggerStage, delayHours, action, emailSubject, emailBody, taskTitle };
}

export async function createAutomation(actor: Actor, input: AutomationInput) {
  if (!can(actor, "leads.viewAll")) throw new DomainError("forbidden", "Accès réservé aux gestionnaires.");
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.leadAutomation)
    .where(eq(schema.leadAutomation.organizationId, actor.organization.id));
  if (n >= MAX_RULES) throw new DomainError("quota_exceeded", `Vous ne pouvez pas dépasser ${MAX_RULES} règles.`);
  const v = parseInput(input);
  const id = newId();
  await db.insert(schema.leadAutomation).values({ id, organizationId: actor.organization.id, createdById: actor.user.id, ...v });
  await audit({ organizationId: actor.organization.id, actorUserId: actor.user.id, actorType: "user", action: "lead.automation.create", targetId: id });
  return id;
}

export async function setAutomationEnabled(actor: Actor, id: string, enabled: boolean) {
  if (!can(actor, "leads.viewAll")) throw new DomainError("forbidden", "Accès réservé aux gestionnaires.");
  const r = await db
    .update(schema.leadAutomation)
    .set({ enabled, updatedAt: new Date() })
    .where(and(eq(schema.leadAutomation.id, id), eq(schema.leadAutomation.organizationId, actor.organization.id)))
    .returning({ id: schema.leadAutomation.id });
  if (r.length === 0) throw new DomainError("not_found", "Règle introuvable.");
}

export async function deleteAutomation(actor: Actor, id: string) {
  if (!can(actor, "leads.viewAll")) throw new DomainError("forbidden", "Accès réservé aux gestionnaires.");
  const r = await db
    .delete(schema.leadAutomation)
    .where(and(eq(schema.leadAutomation.id, id), eq(schema.leadAutomation.organizationId, actor.organization.id)))
    .returning({ id: schema.leadAutomation.id });
  if (r.length === 0) throw new DomainError("not_found", "Règle introuvable.");
}

/** Libellé lisible d'une règle (pour l'interface). */
export function describeAutomation(a: typeof schema.leadAutomation.$inferSelect): string {
  const when =
    a.trigger === "stage_entered"
      ? `à l'arrivée dans « ${STAGE_LABELS[a.triggerStage ?? ""] ?? a.triggerStage} »`
      : a.triggerStage
        ? `sans activité en « ${STAGE_LABELS[a.triggerStage] ?? a.triggerStage} »`
        : "sans activité";
  const delay = a.delayHours % 24 === 0 ? `${a.delayHours / 24} j` : `${a.delayHours} h`;
  const act = a.action === "email" ? "envoyer un email" : "créer une tâche";
  return `${when}, après ${delay} : ${act}.`;
}

/**
 * Exécute les relances automatiques dues. Idempotent : une règle ne se
 * déclenche qu'une seule fois par prospect (table lead_automation_run).
 * Prévu pour être appelé par la tâche planifiée (npm run jobs).
 */
export async function runLeadAutomations(now = new Date()) {
  const rules = await db.select().from(schema.leadAutomation).where(eq(schema.leadAutomation.enabled, true));
  let emails = 0;
  let tasks = 0;

  for (const rule of rules) {
    // 1. Prospects candidats pour cette règle.
    const conds = [eq(schema.lead.organizationId, rule.organizationId)];
    if (rule.trigger === "stage_entered") {
      conds.push(eq(schema.lead.stage, rule.triggerStage!));
    } else {
      conds.push(notInArray(schema.lead.stage, CLOSED));
      if (rule.triggerStage) conds.push(eq(schema.lead.stage, rule.triggerStage));
    }
    const candidates = await db
      .select({ id: schema.lead.id, email: schema.lead.email, stage: schema.lead.stage, createdAt: schema.lead.createdAt, assignedToId: schema.lead.assignedToId })
      .from(schema.lead)
      .where(and(...conds))
      .limit(500);
    if (candidates.length === 0) continue;
    const ids = candidates.map((c) => c.id);

    // 2. Horodatage de référence par prospect.
    //    stage_entered → dernier changement d'étape ; no_activity → dernière activité.
    const actConds = [inArray(schema.leadActivity.leadId, ids)];
    if (rule.trigger === "stage_entered") actConds.push(eq(schema.leadActivity.kind, "stage"));
    const activity = await db
      .select({ leadId: schema.leadActivity.leadId, last: max(schema.leadActivity.createdAt) })
      .from(schema.leadActivity)
      .where(and(...actConds))
      .groupBy(schema.leadActivity.leadId);
    const lastByLead = new Map(activity.map((a) => [a.leadId, a.last as Date | null]));

    // 3. Prospects déjà traités par cette règle.
    const already = await db
      .select({ leadId: schema.leadAutomationRun.leadId })
      .from(schema.leadAutomationRun)
      .where(and(eq(schema.leadAutomationRun.automationId, rule.id), inArray(schema.leadAutomationRun.leadId, ids)));
    const done = new Set(already.map((r) => r.leadId));

    const dueMs = rule.delayHours * 3600_000;
    for (const lead of candidates) {
      if (done.has(lead.id)) continue;
      const ref = lastByLead.get(lead.id) ?? lead.createdAt;
      if (now.getTime() - ref.getTime() < dueMs) continue;

      // Verrou d'idempotence : si une autre exécution a déjà pris ce prospect, on passe.
      const claimed = await db
        .insert(schema.leadAutomationRun)
        .values({ automationId: rule.id, leadId: lead.id, firedAt: now })
        .onConflictDoNothing()
        .returning({ leadId: schema.leadAutomationRun.leadId });
      if (claimed.length === 0) continue;

      if (rule.action === "email") {
        if (!lead.email) continue; // pas d'adresse : rien à envoyer
        const r = await sendEmail({
          to: lead.email,
          template: "leadFollowUp",
          email: templates.leadFollowUp({ subject: rule.emailSubject ?? "", body: rule.emailBody ?? "" }),
          dedupeKey: `automation:${rule.id}:${lead.id}`,
        });
        if (!r.skipped) emails++;
        await db.insert(schema.leadActivity).values({ id: newId(), leadId: lead.id, organizationId: rule.organizationId, kind: "automation", text: `Relance automatique « ${rule.name} » : email envoyé`, actorId: null });
      } else {
        await db.insert(schema.leadTask).values({ id: newId(), leadId: lead.id, organizationId: rule.organizationId, title: rule.taskTitle ?? "Relance", createdById: rule.createdById });
        tasks++;
        await db.insert(schema.leadActivity).values({ id: newId(), leadId: lead.id, organizationId: rule.organizationId, kind: "automation", text: `Relance automatique « ${rule.name} » : tâche créée`, actorId: null });
      }
    }
  }
  return { emails, tasks };
}
