import { isMediaPubliclyServable } from "@/lib/cards/public";
import { storage } from "@/lib/media/storage";
import { mediaResponse } from "@/lib/media/respond";

/**
 * Médias publics : servis uniquement s'ils figurent dans la version publiée d'une carte
 * actuellement accessible. Au retrait de la carte ou à la fin des droits, ils cessent
 * immédiatement d'être servis (cache navigateur court, pas de cache partagé).
 */
export async function GET(req: Request, ctx: RouteContext<"/m/[id]">) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(id)) return new Response("Introuvable", { status: 404 });
  const { ok, media } = await isMediaPubliclyServable(id);
  if (!ok || !media) return new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
  const body = await storage().get(media.storageKey);
  if (!body) return new Response("Introuvable", { status: 404 });
  const params = new URL(req.url).searchParams;
  if (params.get("format") === "png" && media.kind === "image") {
    // Variante PNG pour les services qui ne lisent pas le WebP (ex. Google Wallet).
    const sharp = (await import("sharp")).default;
    const png = await sharp(body).png().toBuffer();
    return mediaResponse(png, { ...media, mimeType: "image/png" }, { cache: "public" });
  }
  return mediaResponse(body, media, { cache: "public", download: params.has("telecharger") });
}
