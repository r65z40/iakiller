import { resolvePublicCard } from "@/lib/cards/public";
import { buildVCard, vcardFilename } from "@/lib/cards/vcard";
import { storage } from "@/lib/media/storage";
import { appUrl } from "@/lib/config";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";

/** vCard de la version publiée, avec les mêmes contrôles d'accès que la page. */
export async function GET(_req: Request, ctx: RouteContext<"/[org]/[person]/vcard">) {
  const { org, person } = await ctx.params;
  const result = await resolvePublicCard(org, person);
  if (result.kind === "redirect") return Response.redirect(`${appUrl()}${result.path}/vcard`, 302);
  if (result.kind !== "ok") return new Response("Carte indisponible", { status: 404, headers: { "Cache-Control": "no-store" } });

  let photo: string | undefined;
  const photoId = result.document.identity.showPhoto ? result.document.identity.photoMediaId : null;
  if (photoId) {
    const [m] = await db.select().from(schema.mediaAsset).where(and(eq(schema.mediaAsset.id, photoId), eq(schema.mediaAsset.organizationId, result.card.organizationId)));
    const buf = m ? await storage().get(m.storageKey) : null;
    if (buf) photo = (await sharp(buf).resize(240, 240, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer()).toString("base64");
  }
  const body = buildVCard(result.document, { cardUrl: `${appUrl()}/${result.organization.slug}/${result.card.slug}`, photoJpegBase64: photo });
  return new Response(body, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${vcardFilename(result.document)}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
