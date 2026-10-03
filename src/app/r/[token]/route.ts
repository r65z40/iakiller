import { getSettings } from "@/lib/settings/store";
import { NextResponse } from "next/server";
import { resolvePublicToken } from "@/lib/cards/public";
import { appUrl } from "@/lib/config";

/**
 * Lien stable du QR code. Il résout l'adresse COURANTE de la carte à chaque scan, ce qui
 * permet de renommer la carte sans réimprimer le QR. Contrôle d'accès identique à la page.
 */
export async function GET(_req: Request, ctx: RouteContext<"/r/[token]">) {
  await getSettings();
  const { token } = await ctx.params;
  const result = await resolvePublicToken(token);
  const base = appUrl();
  if (result.kind === "redirect") {
    const res = NextResponse.redirect(`${base}${result.path}?src=qr`, 302);
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }
  const res = NextResponse.redirect(`${base}/indisponible`, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
