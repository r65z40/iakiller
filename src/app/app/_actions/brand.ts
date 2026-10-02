"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAction } from "@/lib/context";
import { run } from "@/lib/action-result";
import { updateBrand } from "@/lib/brand-service";
import { deleteMedia } from "@/lib/media/service";

export async function updateBrandAction(input: Parameters<typeof updateBrand>[1]) {
  return run(async () => {
    await updateBrand(await requireOrgAction("brand.update"), input);
    revalidatePath("/app", "layout");
    return "Identité enregistrée. Les champs verrouillés s'appliquent à toutes les cartes, y compris celles déjà publiées.";
  });
}

export async function deleteMediaAction(mediaId: string) {
  return run(async () => {
    await deleteMedia(await requireOrgAction(), mediaId);
    revalidatePath("/app/medias");
    return "Fichier supprimé.";
  });
}
