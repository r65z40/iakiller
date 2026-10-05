"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAction } from "@/lib/context";
import { run } from "@/lib/action-result";
import * as automations from "@/lib/leads/automations";

export async function createAutomationAction(input: automations.AutomationInput) {
  return run(async () => {
    await automations.createAutomation(await requireOrgAction("leads.viewAll"), input);
    revalidatePath("/app/relances");
    return "Règle créée.";
  });
}

export async function toggleAutomationAction(id: string, enabled: boolean) {
  return run(async () => {
    await automations.setAutomationEnabled(await requireOrgAction("leads.viewAll"), id, enabled);
    revalidatePath("/app/relances");
    return enabled;
  });
}

export async function deleteAutomationAction(id: string) {
  return run(async () => {
    await automations.deleteAutomation(await requireOrgAction("leads.viewAll"), id);
    revalidatePath("/app/relances");
    return "Règle supprimée.";
  });
}
