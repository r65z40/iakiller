import { getOrgContext } from "@/lib/context";
import { getMediaForActor } from "@/lib/media/service";
import { storage } from "@/lib/media/storage";
import { mediaResponse } from "@/lib/media/respond";

/** Médias privés (aperçu de l'éditeur) : réservés aux membres de l'organisation. */
export async function GET(req: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  const org = await getOrgContext();
  if (!org) return new Response("Non autorisé", { status: 401 });
  try {
    const media = await getMediaForActor(org, id);
    const body = await storage().get(media.storageKey);
    if (!body) return new Response("Introuvable", { status: 404 });
    return mediaResponse(body, media, { cache: "private", download: new URL(req.url).searchParams.has("telecharger") });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
