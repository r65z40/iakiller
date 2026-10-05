import { getSettings } from "@/lib/settings/store";
import { NextResponse } from "next/server";
import { resolvePublicToken } from "@/lib/cards/public";
import { activeQrDest } from "@/lib/cards/qr";
import { recordQrScan } from "@/lib/cards/qr-scan";
import { classifyUserAgent } from "@/lib/analytics/service";
import { appUrl } from "@/lib/config";

/**
 * Lien stable du QR code (« QR intelligent »). À chaque scan, il résout la DESTINATION COURANTE :
 * la carte, un bloc précis de la carte, une URL externe, ou une campagne temporaire (qui revient
 * automatiquement à la destination normale après sa fenêtre). Le QR imprimé ne change jamais.
 * Chaque scan est compté (sans cookie ni identifiant du visiteur).
 */
function finalize(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export async function GET(req: Request, ctx: RouteContext<"/r/[token]">) {
  await getSettings();
  const { token } = await ctx.params;
  const slug = new URL(req.url).searchParams.get("c");
  const result = await resolvePublicToken(token, slug);
  const base = appUrl();

  if (result.kind !== "redirect") {
    return finalize(NextResponse.redirect(`${base}/indisponible`, 302));
  }

  // Comptage du scan (hors robots), sans bloquer la redirection.
  if (!classifyUserAgent(req.headers.get("user-agent")).isBot) {
    await recordQrScan(result.cardId, result.slug);
  }

  const dest = result.variant ? activeQrDest(result.variant) : { type: "card" as const };
  const utm = result.slug ? `&utm_campaign=${encodeURIComponent(result.slug)}` : "";

  if (dest.type === "url" && dest.url) {
    return finalize(NextResponse.redirect(dest.url, 302));
  }
  const anchor = dest.type === "section" && dest.section ? `#${dest.section}` : "";
  return finalize(NextResponse.redirect(`${base}${result.path}?src=qr${utm}${anchor}`, 302));
}
