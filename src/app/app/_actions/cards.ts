"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrgAction } from "@/lib/context";
import { run } from "@/lib/action-result";
import { DomainError } from "@/lib/errors";
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

export async function setQrStyleAction(cardId: string, style: { dark: string; logo: "none" | "card" | "brand" }) {
  return run(async () => {
    const { setCardQrStyle } = await import("@/lib/cards/qr");
    await setCardQrStyle(await requireOrgAction(), cardId, style);
    return "QR code enregistré : la lecture a été vérifiée.";
  });
}

export async function previewImportAction(csv: string) {
  return run(async () => {
    const ctx = await requireOrgAction("cards.create");
    const { mapRows, parseCsv } = await import("@/lib/cards/import");
    if (csv.length > 2_000_000) throw new DomainError("invalid", "Fichier trop volumineux (2 Mo maximum).");
    const mapped = mapRows(parseCsv(csv));
    if (mapped.error) throw new DomainError("invalid", mapped.error);
    const { listCardsForActor } = await import("@/lib/cards/service");
    const active = (await listCardsForActor(ctx)).length;
    return { rows: mapped.rows, unknownColumns: mapped.unknownColumns, remaining: Math.max(0, ctx.entitlement.quotas.cards - active), canPublish: ctx.entitlement.canPublish };
  });
}

export async function runImportAction(csv: string, opts: { template: string; invite: boolean; publish: boolean }) {
  return run(async () => {
    const ctx = await requireOrgAction("cards.create");
    const { runImport } = await import("@/lib/cards/import");
    if (csv.length > 2_000_000) throw new DomainError("invalid", "Fichier trop volumineux (2 Mo maximum).");
    const report = await runImport(ctx, csv, { template: (TEMPLATES as readonly string[]).includes(opts.template) ? (opts.template as TemplateId) : "classique", invite: opts.invite, publish: opts.publish }, ctx.user.name);
    revalidatePath("/app/cartes");
    return report;
  });
}
