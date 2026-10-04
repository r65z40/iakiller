import { getSettings } from "@/lib/settings/store";
import { getOrgContext } from "@/lib/context";
import { getCardForActor } from "@/lib/cards/service";
import { cardQr } from "@/lib/cards/qr";

/** Export du QR code d'une carte (style personnalisé vérifié), réservé aux membres autorisés. */
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
  // Variante d'origine optionnelle : le QR encode alors /r/{token}?c={slug}.
  const c = params.get("c");
  const variant = c && /^[a-z0-9-]{1,32}$/.test(c) && (card.qrVariants ?? []).some((v) => v.slug === c) ? c : null;
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  if (params.has("download")) headers["Content-Disposition"] = `attachment; filename="qr-${card.slug}${variant ? `-${variant}` : ""}.${format}"`;
  const out = await cardQr(card, format, variant);
  if (format === "png") return new Response(new Uint8Array(out as Buffer), { headers: { ...headers, "Content-Type": "image/png" } });
  return new Response(out as string, { headers: { ...headers, "Content-Type": "image/svg+xml", "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'" } });
}
