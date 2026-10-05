"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAction } from "@/lib/context";
import { run } from "@/lib/action-result";
import * as leads from "@/lib/leads/service";

/** Déplace un prospect dans une autre étape du pipeline (drag & drop du Kanban). */
export async function moveLeadStageAction(leadId: string, stage: string) {
  return run(async () => {
    await leads.updateLead(await requireOrgAction(), leadId, { stage });
    revalidatePath("/app/prospects");
    return stage;
  });
}

/** Met à jour les champs CRM d'un prospect (étape, notes, tags, responsable). */
export async function updateLeadAction(
  leadId: string,
  patch: { stage?: string; notes?: string; tags?: string[]; assignedToId?: string | null },
) {
  return run(async () => {
    await leads.updateLead(await requireOrgAction(), leadId, patch);
    revalidatePath("/app/prospects");
    revalidatePath(`/app/prospects/${leadId}`);
    return "Enregistré.";
  });
}

export async function deleteLeadAction(leadId: string) {
  return run(async () => {
    await leads.deleteLead(await requireOrgAction(), leadId);
    revalidatePath("/app/prospects");
    return "Demande supprimée.";
  });
}

export async function addLeadTaskAction(leadId: string, title: string, dueAt: string | null) {
  return run(async () => {
    await leads.addLeadTask(await requireOrgAction(), leadId, { title, dueAt });
    revalidatePath(`/app/prospects/${leadId}`);
    return "Tâche ajoutée.";
  });
}

export async function toggleLeadTaskAction(taskId: string, leadId: string, done: boolean) {
  return run(async () => {
    await leads.setLeadTaskDone(await requireOrgAction(), taskId, done);
    revalidatePath(`/app/prospects/${leadId}`);
    return done;
  });
}

export async function deleteLeadTaskAction(taskId: string, leadId: string) {
  return run(async () => {
    await leads.deleteLeadTask(await requireOrgAction(), taskId);
    revalidatePath(`/app/prospects/${leadId}`);
    return "Tâche supprimée.";
  });
}
