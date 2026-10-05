import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isCardPubliclyAccessible } from "@/lib/cards/public";
import { parseDocument } from "@/lib/cards/document";
import { uploadLeadPhoto } from "@/lib/media/service";
import { isSameOrigin } from "@/lib/security/origin";
import { clientIp, ipFingerprint, rateLimit } from "@/lib/security/rate-limit";
import { limits } from "@/lib/config";
import { DomainError } from "@/lib/errors";

/**
 * Pièce jointe (photo) envoyée par un visiteur depuis un formulaire de carte. Sécurisé :
 * même origine, limitation de débit par IP, carte publiée dont le formulaire autorise les photos,
 * type réel et ré-encodage assurés par uploadLeadPhoto. Retourne l'identifiant du média créé.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > limits.imageMaxBytes + 1024 * 64) return NextResponse.json({ error: "Image trop lourde." }, { status: 413 });

  const h = await nextHeaders();
  const ipKey = ipFingerprint(clientIp(h));
  // Anti-abus : au plus 15 photos / 10 min par connexion.
  if (!rateLimit(`leadupload:${ipKey}`, 15, 10 * 60_000)) {
    return NextResponse.json({ error: "Trop d'envois. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const form = await req.formData();
  const token = String(form.get("token") ?? "");
  const file = form.get("file");
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier." }, { status: 400 });

  const [card] = await db.select().from(schema.card).where(eq(schema.card.publicToken, token));
  if (!card || !(await isCardPubliclyAccessible(card))) return NextResponse.json({ error: "Carte indisponible." }, { status: 404 });
  const [version] = card.publishedVersionId ? await db.select().from(schema.cardVersion).where(eq(schema.cardVersion.id, card.publishedVersionId)) : [];
  const parsed = version ? parseDocument(version.document) : null;
  const formBlock = parsed?.success ? parsed.data.blocks.find((b) => b.type === "leadForm" && !b.hidden) : undefined;
  if (!formBlock || formBlock.type !== "leadForm" || !formBlock.allowPhotos) {
    return NextResponse.json({ error: "L'ajout de photos n'est pas autorisé sur ce formulaire." }, { status: 403 });
  }

  try {
    const id = await uploadLeadPhoto(card.organizationId, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
