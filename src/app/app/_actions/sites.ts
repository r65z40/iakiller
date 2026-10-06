"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAction } from "@/lib/context";
import { run } from "@/lib/action-result";
import * as sites from "@/lib/sites/service";

export async function createSiteAction(input: { title: string; template?: string; fromCardId?: string }) {
  return run(async () => {
    const { id } = await sites.createSite(await requireOrgAction("cards.create"), input);
    revalidatePath("/app/mini-sites");
    return id;
  });
}

export async function saveSiteDraftAction(siteId: string, revision: number, document: unknown, title?: string) {
  return run(async () => sites.saveSiteDraft(await requireOrgAction("cards.create"), siteId, { revision, document, title }));
}

export async function publishSiteAction(siteId: string) {
  return run(async () => {
    const r = await sites.publishSite(await requireOrgAction("cards.create"), siteId);
    revalidatePath("/app/mini-sites");
    return r;
  });
}

export async function unpublishSiteAction(siteId: string) {
  return run(async () => {
    await sites.unpublishSite(await requireOrgAction("cards.create"), siteId);
    revalidatePath("/app/mini-sites");
    return "Mini-site dépublié.";
  });
}

export async function deleteSiteAction(siteId: string) {
  return run(async () => {
    await sites.deleteSite(await requireOrgAction("cards.create"), siteId);
    revalidatePath("/app/mini-sites");
    return "Mini-site supprimé.";
  });
}
