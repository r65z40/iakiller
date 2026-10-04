import { getSettings } from "@/lib/settings/store";
import { NextResponse } from "next/server";
import { resolvePublicToken } from "@/lib/cards/public";
import { appUrl } from "@/lib/config";

/**
 * Lien stable du QR code. Il résout l'adresse COURANTE de la carte à chaque scan, ce qui
 * permet de renommer la carte sans réimprimer le QR. Contrôle d'accès identique à la page.
 */
export async function GET(req: Request, ctx: RouteContext<"/r/[token]">) {
  await getSettings();
  const { token } = await ctx.params;
  const variant = new URL(req.url).searchParams.get("c");
  const result = await resolvePublicToken(token, variant);
  const base = appUrl();
  if (result.kind === "redirect") {
    // src=qr identifie un scan ; la variante (origine) voyage dans utm_campaign pour le suivi.
    const target = `${base}${result.path}?src=qr${result.campaign ? `&utm_campaign=${encodeURIComponent(result.campaign)}` : ""}`;
    const res = NextResponse.redirect(target, 302);
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }
  const res = NextResponse.redirect(`${base}/indisponible`, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
