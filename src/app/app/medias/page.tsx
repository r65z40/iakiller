import { and, eq, isNull, sql } from "drizzle-orm";
import { requireOrgPage } from "@/lib/context";
import { listMedia } from "@/lib/media/service";
import { db, schema } from "@/lib/db";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { MediaActions, UploadBox } from "./MediaClient";

export default async function MediaPage() {
  const ctx = await requireOrgPage();
  const media = await listMedia(ctx);
  const [used] = await db
    .select({ bytes: sql<number>`coalesce(sum(${schema.mediaAsset.sizeBytes}),0)::bigint` })
    .from(schema.mediaAsset)
    .where(and(eq(schema.mediaAsset.organizationId, ctx.organization.id), isNull(schema.mediaAsset.deletedAt)));
  const usedMb = Number(used.bytes) / 1024 / 1024;
  return (
    <>
      <PageHeader title="Médias" description={`${usedMb.toFixed(1).replace(".", ",")} Mo utilisés sur ${ctx.entitlement.quotas.storageMb} Mo. Les fichiers ne sont visibles publiquement que s'ils figurent sur une carte publiée et active.`} />
      <Panel className="mb-6"><UploadBox /></Panel>
      {media.length === 0 ? (
        <EmptyState title="Aucun fichier">Envoyez des images (JPEG, PNG, WebP) ou des documents PDF.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {media.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-xl bg-white ring-1 ring-line">
              {m.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${m.id}`} alt={m.originalName} className="aspect-square w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-surface text-sm font-bold text-muted">PDF</div>
              )}
              <div className="p-2 text-xs">
                <p className="truncate font-semibold" title={m.originalName}>{m.originalName}</p>
                <p className="text-muted">{Math.max(1, Math.round(m.sizeBytes / 1024))} Ko · {formatDate(m.createdAt)}</p>
                {can(ctx, "cards.manageAll") && <MediaActions id={m.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
