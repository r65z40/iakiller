import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireOrgPage } from "@/lib/context";
import { getSiteForActor } from "@/lib/sites/service";
import { listMedia } from "@/lib/media/service";
import { db, schema } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { isLockable } from "@/lib/brand";
import { parseSiteDocument } from "@/lib/sites/document";
import { emptySiteDocument } from "@/lib/sites/defaults";
import { SiteEditor } from "@/components/sites/SiteEditor";
import { DomainError } from "@/lib/errors";

export default async function SiteEditorPage({ params }: PageProps<"/app/mini-sites/[id]">) {
  const { id } = await params;
  const ctx = await requireOrgPage("cards.create");
  let site;
  try {
    site = await getSiteForActor(ctx, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }

  const [media, brand] = await Promise.all([
    listMedia(ctx),
    db.select().from(schema.brandSettings).where(eq(schema.brandSettings.organizationId, ctx.organization.id)).then((r) => r[0] ?? null),
  ]);
  const locked = new Set((brand?.lockedFields ?? []).filter(isLockable));
  const parsed = parseSiteDocument(site.draft);
  const doc = parsed.success ? parsed.data : emptySiteDocument();
  const ent = ctx.entitlement;

  return (
    <SiteEditor
      site={{
        id: site.id,
        title: site.title,
        slug: site.slug,
        status: site.status,
        revision: site.draftRevision,
        publishedAt: site.publishedAt?.toISOString() ?? null,
        publicUrl: `${appUrl()}/s/${ctx.organization.slug}/${site.slug}`,
        hasUnpublishedChanges: !site.publishedAt || site.draftUpdatedAt > site.publishedAt,
      }}
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
      canPublish={ent.canPublish && !site.adminSuspendedAt}
      publishBlockedReason={site.adminSuspendedAt ? "Mini-site suspendu par la plateforme." : !ent.canPublish ? "Publication impossible sans essai ni abonnement actif." : null}
    />
  );
}
