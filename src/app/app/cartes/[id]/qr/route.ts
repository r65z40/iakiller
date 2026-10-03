import { getSettings } from "@/lib/settings/store";
import { getOrgContext } from "@/lib/context";
import { getCardForActor } from "@/lib/cards/service";
import { qrPng, qrSvg, qrTargetUrl } from "@/lib/cards/qr";

/** Export du QR code d'une carte, réservé aux membres autorisés. */
export async function GET(req: Request, ctx: RouteContext<"/app/cartes/[id]/qr">) {
  await getSettings();
  const { id } = await ctx.params;
  const org = await getOrgContext();
  if (!org) return new Response("Non autorisé", { status: 401 });
  let card;
  try {
    card = await getCardForActor(org, id);
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
  const params = new URL(req.url).searchParams;
  const format = params.get("format") === "png" ? "png" : "svg";
  const download = params.has("download");
  const url = qrTargetUrl(card.publicToken);
  const filename = `qr-${card.slug}.${format}`;
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  if (download) headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  if (format === "png") return new Response(new Uint8Array(await qrPng(url)), { headers: { ...headers, "Content-Type": "image/png" } });
  return new Response(await qrSvg(url), { headers: { ...headers, "Content-Type": "image/svg+xml", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } });
}
