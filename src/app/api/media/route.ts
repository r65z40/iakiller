import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/context";
import { uploadMedia } from "@/lib/media/service";
import { DomainError } from "@/lib/errors";
import { isSameOrigin } from "@/lib/security/origin";
import { limits } from "@/lib/config";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origine refusée" }, { status: 403 });
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > limits.pdfMaxBytes + 1024 * 64) return NextResponse.json({ error: "Fichier trop lourd." }, { status: 413 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    const purpose = form.get("purpose") === "document" ? "document" : "image";
    if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    const media = await uploadMedia(ctx, { buffer: Buffer.from(await file.arrayBuffer()), name: file.name }, purpose);
    return NextResponse.json({ media: { ...media, url: `/api/media/${media.id}` } });
  } catch (err) {
    if (err instanceof DomainError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[upload]", err);
    return NextResponse.json({ error: "Envoi impossible." }, { status: 500 });
  }
}
