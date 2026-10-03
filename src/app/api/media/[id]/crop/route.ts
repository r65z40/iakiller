import { NextResponse } from "next/server";
import sharp from "sharp";
import { getOrgContext } from "@/lib/context";
import { getMediaForActor, uploadMedia } from "@/lib/media/service";
import { storage } from "@/lib/media/storage";
import { cropRect } from "@/lib/media/crop";
import { DomainError } from "@/lib/errors";
import { isSameOrigin } from "@/lib/security/origin";

/** Recadre une image de l'organisation : crée une NOUVELLE image, l'originale est conservée. */
export async function POST(req: Request, ctx: RouteContext<"/api/media/[id]/crop">) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origine refusée" }, { status: 403 });
  const org = await getOrgContext();
  if (!org) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const params = { aspect: Number(body.aspect), zoom: Number(body.zoom), x: Number(body.x), y: Number(body.y) };
    if (Object.values(params).some((v) => !Number.isFinite(v))) throw new DomainError("invalid", "Paramètres de recadrage invalides.");
    const media = await getMediaForActor(org, id);
    if (media.kind !== "image") throw new DomainError("invalid", "Seules les images se recadrent.");
    const buf = await storage().get(media.storageKey);
    if (!buf) throw new DomainError("not_found", "Fichier introuvable.");
    const meta = await sharp(buf).metadata();
    const rect = cropRect(meta.width!, meta.height!, params);
    const cropped = await sharp(buf).extract(rect).png().toBuffer();
    const name = media.originalName.replace(/(\.[a-z0-9]+)?$/i, " (recadrée)$1");
    const created = await uploadMedia(org, { buffer: cropped, name }, "image");
    return NextResponse.json({ media: { ...created, url: `/api/media/${created.id}` } });
  } catch (err) {
    if (err instanceof DomainError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[crop]", err);
    return NextResponse.json({ error: "Recadrage impossible." }, { status: 500 });
  }
}
