"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE, getCurrentUser, requireOrgAction } from "@/lib/context";
import { run } from "@/lib/action-result";
import * as members from "@/lib/orgs/members";
import * as leads from "@/lib/leads/service";
import { DomainError } from "@/lib/errors";
import type { OrgRole } from "@/lib/permissions";

export async function inviteAction(_prev: unknown, fd: FormData) {
  return run(async () => {
    const ctx = await requireOrgAction("members.manage");
    await members.inviteMember(ctx, String(fd.get("email") ?? ""), String(fd.get("role") ?? "member") as OrgRole, ctx.user.name);
    revalidatePath("/app/membres");
    return "Invitation envoyée (valable 7 jours).";
  });
}

export async function revokeInvitationAction(id: string) {
  return run(async () => {
    await members.revokeInvitation(await requireOrgAction("members.manage"), id);
    revalidatePath("/app/membres");
    return "Invitation révoquée.";
  });
}

export async function changeRoleAction(membershipId: string, role: OrgRole, billing: boolean) {
  return run(async () => {
    await members.changeMemberRole(await requireOrgAction("members.manage"), membershipId, role, billing);
    revalidatePath("/app/membres");
    return "Rôle modifié.";
  });
}

export async function removeMemberAction(membershipId: string, disableCards: boolean) {
  return run(async () => {
    await members.removeMember(await requireOrgAction("members.manage"), membershipId, { disableAssignedCards: disableCards });
    revalidatePath("/app/membres");
    return "Membre retiré. Ses accès sont révoqués immédiatement.";
  });
}

export async function leaveOrganizationAction() {
  const r = await run(async () => {
    await members.leaveOrganization(await requireOrgAction());
    (await cookies()).delete(ACTIVE_ORG_COOKIE);
  });
  if (r.ok) redirect("/app");
  return r;
}

export async function acceptInvitationAction(token: string) {
  const r = await run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("forbidden", "Connectez-vous pour accepter l'invitation.");
    const org = await members.acceptInvitation(user, token);
    (await cookies()).set(ACTIVE_ORG_COOKIE, org.id, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.APP_URL?.startsWith("https://") });
    return org.id;
  });
  if (r.ok) redirect("/app");
  return r;
}

export async function updateLeadAction(leadId: string, patch: { status?: string; notes?: string }) {
  return run(async () => {
    await leads.updateLead(await requireOrgAction(), leadId, patch);
    revalidatePath("/app/prospects");
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
