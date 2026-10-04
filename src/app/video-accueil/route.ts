import { storage } from "@/lib/media/storage";
import { getSettings } from "@/lib/settings/store";

export const dynamic = "force-dynamic";

/**
 * Diffuse la vidéo de présentation réglée dans l'administration. Objet de stockage privé
 * servi par l'application, avec prise en charge des requêtes Range (lecture et déplacement
 * dans la vidéo). Renvoie 404 tant qu'aucune vidéo n'est configurée.
 */
export async function GET(req: Request) {
  const settings = await getSettings();
  const key = settings.brand.promoVideoKey;
  if (!key) return new Response("Aucune vidéo.", { status: 404, headers: { "Cache-Control": "no-store" } });

  const body = await storage().get(key);
  if (!body) return new Response("Introuvable.", { status: 404, headers: { "Cache-Control": "no-store" } });

  const type = settings.brand.promoVideoType || "video/mp4";
  const total = body.length;
  const baseHeaders: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "public, max-age=3600, must-revalidate",
    "CDN-Cache-Control": "no-store",
  };

  const range = req.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (match) {
    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : total - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      return new Response("Plage invalide.", { status: 416, headers: { "Content-Range": `bytes */${total}`, "Accept-Ranges": "bytes" } });
    }
    end = Math.min(end, total - 1);
    start = Math.max(0, start);
    const chunk = body.subarray(start, end + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: { ...baseHeaders, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": String(chunk.length) },
    });
  }

  return new Response(new Uint8Array(body), { status: 200, headers: { ...baseHeaders, "Content-Length": String(total) } });
}
