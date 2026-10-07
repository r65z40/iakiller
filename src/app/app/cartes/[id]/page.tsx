import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { requireOrgPage } from "@/lib/context";
import { getCardForActor, listVersions } from "@/lib/cards/service";
import { listMedia } from "@/lib/media/service";
import { db, schema } from "@/lib/db";
import { can } from "@/lib/permissions";
import { appUrl } from "@/lib/config";
import { qrTargetUrl, normalizeQrVariants } from "@/lib/cards/qr";
import { scansByVariant } from "@/lib/cards/qr-scan";
import { parseDocument } from "@/lib/cards/document";
import { emptyDocument } from "@/lib/cards/defaults";
import { isLockable } from "@/lib/brand";
import { Editor } from "@/components/editor/Editor";
import { walletAvailability } from "@/lib/wallet/load";
import { DomainError } from "@/lib/errors";

export default async function CardEditorPage({ params }: PageProps<"/app/cartes/[id]">) {
  const { id } = await params;
  const ctx = await requireOrgPage();
  let card;
  try {
    card = await getCardForActor(ctx, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  if (card.status === "archived") notFound();

  const [media, versions, brand, siteRows] = await Promise.all([
    listMedia(ctx),
    listVersions(ctx, id),
    db.select().from(schema.brandSettings).where(eq(schema.brandSettings.organizationId, ctx.organization.id)).then((r) => r[0] ?? null),
    // Mini-sites publiés : destinations possibles d'un QR intelligent (uniquement si la suite est incluse).
    ctx.entitlement.marketingSuite
      ? db.select({ slug: schema.site.slug, title: schema.site.title }).from(schema.site).where(and(eq(schema.site.organizationId, ctx.organization.id), eq(schema.site.status, "published")))
      : Promise.resolve([] as { slug: string; title: string }[]),
  ]);
  const manage = can(ctx, "cards.manageAll");
  const members = manage
    ? await db
        .select({ userId: schema.user.id, name: schema.user.name, email: schema.user.email })
        .from(schema.membership)
        .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
        .where(and(eq(schema.membership.organizationId, ctx.organization.id), inArray(schema.membership.role, ["member", "manager"])))
    : [];
  const assignees = manage ? (await db.select({ userId: schema.cardAssignment.userId }).from(schema.cardAssignment).where(eq(schema.cardAssignment.cardId, id))).map((a) => a.userId) : [];

  const locked = new Set((brand?.lockedFields ?? []).filter(isLockable));
  const parsed = parseDocument(card.draft);
  const doc = parsed.success ? parsed.data : emptyDocument();
  const ent = ctx.entitlement;

  return (
    <Editor
      card={{
        id: card.id,
        title: card.title,
        status: card.status,
        slug: card.slug,
        revision: card.draftRevision,
        publishedAt: card.publishedAt?.toISOString() ?? null,
        disabled: !!card.disabledAt,
        hasUnpublishedChanges: !card.publishedAt || card.draftUpdatedAt > card.publishedAt,
        qrStyle: card.qrStyle ?? { dark: "#000000", logo: "none" },
        qrVariants: normalizeQrVariants(card.qrVariants ?? []),
      }}
      qrScans={await scansByVariant(card.id)}
      initialDoc={doc}
      library={media.map((m) => ({ id: m.id, kind: m.kind as "image" | "document", url: `/api/media/${m.id}`, name: m.originalName, sizeBytes: m.sizeBytes, width: m.width, height: m.height }))}
      locks={{
        primaryColor: locked.has("primaryColor"),
        pageBackground: locked.has("pageBackground"),
        textColor: locked.has("textColor"),
        font: locked.has("font"),
        logo: locked.has("logo"),
        company: locked.has("company"),
      }}
      publicBase={`${appUrl()}/${ctx.organization.slug}`}
      qrShortUrl={qrTargetUrl(card.publicToken)}
      versions={versions.map((v) => ({ id: v.id, number: v.number, createdAt: v.createdAt.toISOString() }))}
      canManage={manage}
      canPublish={ent.canPublish && !card.adminSuspendedAt}
      publishBlockedReason={card.adminSuspendedAt ? "Carte suspendue par la plateforme." : !ent.canPublish ? "Publication impossible sans essai ni abonnement actif." : null}
      members={members}
      assignees={assignees}
      wallet={{ apple: walletAvailability().apple ? "#" : undefined, google: walletAvailability().google ? "#" : undefined }}
      sites={siteRows}
    />
  );
}
