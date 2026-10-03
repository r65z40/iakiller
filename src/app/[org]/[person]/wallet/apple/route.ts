import { getSettings } from "@/lib/settings/store";
import { resolvePublicCard } from "@/lib/cards/public";
import { appleWalletConfig, buildApplePass } from "@/lib/wallet/apple";
import { orgImage } from "@/lib/wallet/load";
import { qrTargetUrl } from "@/lib/cards/qr";
import { appUrl } from "@/lib/config";
import { vcardFilename } from "@/lib/cards/vcard";

/** Pass Apple Wallet de la version publiée (mêmes contrôles d'accès que la page). */
export async function GET(_req: Request, ctx: RouteContext<"/[org]/[person]/wallet/apple">) {
  await getSettings();
  const cfg = appleWalletConfig();
  if (!cfg) return new Response("Apple Wallet n'est pas configuré.", { status: 404 });
  const { org, person } = await ctx.params;
  const result = await resolvePublicCard(org, person);
  if (result.kind !== "ok") return new Response("Carte indisponible", { status: 404, headers: { "Cache-Control": "no-store" } });
  const { document: doc, card } = result;
  const [logo, photo] = await Promise.all([
    doc.identity.showLogo ? orgImage(card.organizationId, doc.identity.logoMediaId) : null,
    doc.identity.showPhoto ? orgImage(card.organizationId, doc.identity.photoMediaId) : null,
  ]);
  try {
    const pass = await buildApplePass(cfg, { doc, serial: card.id, cardUrl: `${appUrl()}/${result.organization.slug}/${card.slug}`, qrUrl: qrTargetUrl(card.publicToken), logo, photo });
    return new Response(new Uint8Array(pass), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${vcardFilename(doc).replace(/\.vcf$/, ".pkpass")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[wallet:apple]", e);
    return new Response("Génération du pass impossible.", { status: 500 });
  }
}
