"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrgAction } from "@/lib/context";
import { run } from "@/lib/action-result";
import * as support from "@/lib/support/service";

export async function createTicketAction(_prev: unknown, fd: FormData) {
  const r = await run(async () => support.createTicket(await requireOrgAction("support.create"), String(fd.get("subject") ?? ""), String(fd.get("body") ?? ""), String(fd.get("mediaId") ?? "") || null));
  if (r.ok) redirect(`/app/assistance/${r.data.id}`);
  return r;
}

export async function replyTicketAction(ticketId: string, body: string) {
  return run(async () => {
    await support.replyTicket(await requireOrgAction(), ticketId, body);
    revalidatePath(`/app/assistance/${ticketId}`);
    return "Message envoyé.";
  });
}

export async function revokeGrantAction(grantId: string) {
  return run(async () => {
    await support.revokeGrantByOrg(await requireOrgAction("members.manage"), grantId);
    revalidatePath("/app/assistance");
    return "Accès d'assistance révoqué.";
  });
}
