import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireOrgPage } from "@/lib/context";
import { getCardForActor } from "@/lib/cards/service";
import { db, schema } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { parseDocument, publicDocument } from "@/lib/cards/document";
import { emptyDocument } from "@/lib/cards/defaults";
import { signatureInputFromDocument } from "@/lib/signature/build";
import { PageHeader } from "@/components/ui";
import { SignatureClient } from "./SignatureClient";
import { DomainError } from "@/lib/errors";

export const metadata: Metadata = { title: "Signature email", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SignaturePage({ params }: PageProps<"/app/cartes/[id]/signature">) {
  const { id } = await params;
  const ctx = await requireOrgPage();
  let card;
  try {
    card = await getCardForActor(ctx, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const [org] = await db.select({ slug: schema.organization.slug }).from(schema.organization).where(eq(schema.organization.id, ctx.organization.id));
  const published = card.publishedVersionId
    ? await db.select({ document: schema.cardVersion.document }).from(schema.cardVersion).where(and(eq(schema.cardVersion.id, card.publishedVersionId), eq(schema.cardVersion.cardId, card.id))).then((r) => r[0]?.document)
    : null;
  const source = published ?? card.draft;
  const parsed = parseDocument(source);
  const doc = publicDocument(parsed.success ? parsed.data : emptyDocument());
  const cardUrl = `${appUrl()}/${org.slug}/${card.slug}`;
  const input = signatureInputFromDocument(doc, { cardUrl, mediaUrl: (mid) => `${appUrl()}/m/${mid}` });
  // Mini QR public (servi uniquement si la carte est publiée et accessible).
  if (card.publishedVersionId) input.qrUrl = `${appUrl()}/r/${card.publicToken}/qr`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <PageHeader
        title="Signature email"
        description="Une signature élégante, aux couleurs de votre carte, à coller dans Gmail, Outlook ou Apple Mail. Elle renvoie vers votre carte de visite."
        actions={<Link href={`/app/cartes/${card.id}`} className="text-sm font-semibold text-brand underline">← Retour à la carte</Link>}
      />
      {!card.publishedVersionId && (
        <p className="mb-4 rounded-lg bg-surface p-3 text-sm text-muted">
          Cette carte n&apos;est pas encore publiée : le bouton « Voir ma carte » ne fonctionnera qu&apos;une fois la carte publiée.
        </p>
      )}
      <SignatureClient input={input} />
    </div>
  );
}
