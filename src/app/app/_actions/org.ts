"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ACTIVE_ORG_COOKIE, getCurrentUser, listMemberships, requireOrgAction } from "@/lib/context";
import { createOrganization, deleteOrganization, transferOwnership, updateOrganization } from "@/lib/orgs/service";
import { run } from "@/lib/action-result";
import { DomainError } from "@/lib/errors";

async function setActiveCookie(orgId: string) {
  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", secure: process.env.APP_URL?.startsWith("https://"), path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function createOrganizationAction(_prev: unknown, fd: FormData) {
  const result = await run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("forbidden", "Session expirée, reconnectez-vous.");
    const org = await createOrganization(user, { name: String(fd.get("name") ?? ""), slug: String(fd.get("slug") ?? "") || undefined });
    await setActiveCookie(org.id);
    return org;
  });
  if (result.ok) redirect("/app?bienvenue=1");
  return result;
}

/** Changement d'organisation active : l'appartenance est vérifiée avant d'écrire le cookie. */
export async function switchOrganizationAction(fd: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const orgId = String(fd.get("organizationId") ?? "");
  const memberships = await listMemberships(user.id);
  if (memberships.some((m) => m.organization.id === orgId)) await setActiveCookie(orgId);
  redirect("/app");
}

export async function updateOrganizationAction(_prev: unknown, fd: FormData) {
  return run(async () => {
    const ctx = await requireOrgAction("org.update");
    await updateOrganization(ctx, {
      name: String(fd.get("name") ?? ""),
      slug: String(fd.get("slug") ?? ""),
      allowIndexing: fd.get("allowIndexing") === "on",
    });
    revalidatePath("/app", "layout");
    return "Paramètres enregistrés.";
  });
}

export async function transferOwnershipAction(_prev: unknown, fd: FormData) {
  return run(async () => {
    const ctx = await requireOrgAction("org.transferOwnership");
    await transferOwnership(ctx, String(fd.get("userId") ?? ""));
    revalidatePath("/app", "layout");
    return "Propriété transférée.";
  });
}

export async function deleteOrganizationAction(_prev: unknown, fd: FormData) {
  const result = await run(async () => {
    const ctx = await requireOrgAction("org.delete");
    await deleteOrganization(ctx, String(fd.get("confirm") ?? ""));
    (await cookies()).delete(ACTIVE_ORG_COOKIE);
  });
  if (result.ok) redirect("/app");
  return result;
}
