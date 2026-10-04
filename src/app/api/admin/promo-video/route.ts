import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/security/origin";
import { requireStaffAction } from "@/lib/context";
import { setPromoVideo, clearPromoVideo } from "@/lib/settings/promo-video";
import { limits } from "@/lib/config";
import { DomainError } from "@/lib/errors";

async function staffOr403() {
  try {
    return await requireStaffAction("platform.settings.manage");
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const staff = await staffOr403();
  if (!staff) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > limits.videoMaxBytes + 1024 * 64) return NextResponse.json({ error: "Vidéo trop lourde." }, { status: 413 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier." }, { status: 400 });

  try {
    const { type } = await setPromoVideo(staff, { buffer: Buffer.from(await file.arrayBuffer()) });
    return NextResponse.json({ ok: true, type });
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const staff = await staffOr403();
  if (!staff) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  await clearPromoVideo(staff);
  return NextResponse.json({ ok: true });
}
