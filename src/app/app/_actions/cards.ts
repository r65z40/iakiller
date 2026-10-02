"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrgAction } from "@/lib/context";
import { run } from "@/lib/action-result";
import * as cards from "@/lib/cards/service";
import { TEMPLATES, type TemplateId } from "@/lib/cards/document";

export async function createCardAction(_prev: unknown, fd: FormData) {
  const result = await run(async () => {
    const ctx = await requireOrgAction("cards.create");
    const template = String(fd.get("template") ?? "classique");
    const assignee = String(fd.get("assignee") ?? "");
    return cards.createCard(ctx, {
      title: String(fd.get("title") ?? ""),
      template: (TEMPLATES as readonly string[]).includes(template) ? (template as TemplateId) : "classique",
      assignToUserId: assignee || null,
    });
  });
  if (result.ok) redirect(`/app/cartes/${result.data.id}`);
  return result;
}

export async function saveDraftAction(cardId: string, revision: number, document: unknown, title?: string) {
  return run(async () => cards.saveDraft(await requireOrgAction(), cardId, { revision, document, title }));
}

export async function publishCardAction(cardId: string) {
  return run(async () => {
    const res = await cards.publishCard(await requireOrgAction(), cardId);
    revalidatePath("/app/cartes");
    return res;
  });
}

async function simple(fn: (ctx: Awaited<ReturnType<typeof requireOrgAction>>) => Promise<unknown>, message: string) {
  return run(async () => {
    const ctx = await requireOrgAction();
    await fn(ctx);
    revalidatePath("/app/cartes", "layout");
    return message;
  });
}

export async function unpublishCardAction(cardId: string) {
  return simple((ctx) => cards.unpublishCard(ctx, cardId), "Carte retirée de la publication.");
}
export async function archiveCardAction(cardId: string) {
  return simple((ctx) => cards.archiveCard(ctx, cardId), "Carte archivée.");
}
export async function unarchiveCardAction(cardId: string) {
  return simple((ctx) => cards.unarchiveCard(ctx, cardId), "Carte désarchivée (brouillon).");
}
export async function deleteCardAction(cardId: string) {
  return simple((ctx) => cards.deleteArchivedCard(ctx, cardId), "Carte supprimée définitivement.");
}
export async function setCardDisabledAction(cardId: string, disabled: boolean) {
  return simple((ctx) => cards.setCardDisabled(ctx, cardId, disabled), disabled ? "Carte désactivée." : "Carte réactivée.");
}
export async function duplicateCardAction(cardId: string) {
  const result = await run(async () => cards.duplicateCard(await requireOrgAction(), cardId));
  if (result.ok) redirect(`/app/cartes/${result.data.id}`);
  return result;
}
export async function renameCardSlugAction(cardId: string, slug: string) {
  return run(async () => {
    const s = await cards.renameCardSlug(await requireOrgAction(), cardId, slug);
    revalidatePath(`/app/cartes/${cardId}`);
    return s;
  });
}
export async function setCardAssigneesAction(cardId: string, userIds: string[]) {
  return simple((ctx) => cards.setCardAssignees(ctx, cardId, userIds), "Attribution enregistrée.");
}
export async function restoreVersionAction(cardId: string, versionId: string) {
  return run(async () => cards.restoreVersion(await requireOrgAction(), cardId, versionId));
}
