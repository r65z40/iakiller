import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings/store";
import { resolvePublicCard } from "@/lib/cards/public";
import { buildGoogleSaveUrl, googleWalletConfig } from "@/lib/wallet/google";
import { qrTargetUrl } from "@/lib/cards/qr";
import { appUrl } from "@/lib/config";

/** Redirige vers « Enregistrer dans Google Wallet » avec un JWT signé côté serveur. */
export async function GET(_req: Request, ctx: RouteContext<"/[org]/[person]/wallet/google">) {
  await getSettings();
  const cfg = googleWalletConfig();
  if (!cfg) return new Response("Google Wallet n'est pas configuré.", { status: 404 });
  const { org, person } = await ctx.params;
  const result = await resolvePublicCard(org, person);
  if (result.kind !== "ok") return new Response("Carte indisponible", { status: 404, headers: { "Cache-Control": "no-store" } });
  const { document: doc, card } = result;
  const logoId = doc.identity.showLogo ? doc.identity.logoMediaId : null;
  const url = buildGoogleSaveUrl(cfg, {
    doc,
    objectSuffix: `carte-${card.id}`,
    cardUrl: `${appUrl()}/${result.organization.slug}/${card.slug}`,
    qrUrl: qrTargetUrl(card.publicToken),
    origin: appUrl(),
    // Google récupère le logo lui-même : URL publique contrôlée, convertie en PNG.
    logoUrl: logoId && appUrl().startsWith("https://") ? `${appUrl()}/m/${logoId}?format=png` : null,
  });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
