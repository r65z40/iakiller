import Link from "next/link";
import { requireOrgPage } from "@/lib/context";
import { listCardsForActor } from "@/lib/cards/service";
import { can } from "@/lib/permissions";
import { appUrl } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { parseDocument } from "@/lib/cards/document";
import { emptyDocument, TEMPLATE_PRESETS } from "@/lib/cards/defaults";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { CardThumbnail } from "@/components/card/CardThumbnail";
import { CardRowActions } from "./CardRowActions";

function statusBadge(card: { status: string; disabledAt: Date | null; adminSuspendedAt: Date | null }) {
  if (card.adminSuspendedAt) return <Badge tone="danger">Suspendue</Badge>;
  if (card.disabledAt) return <Badge tone="danger">Désactivée</Badge>;
  if (card.status === "published") return <Badge tone="success">Publiée</Badge>;
  if (card.status === "archived") return <Badge>Archivée</Badge>;
  return <Badge tone="warning">Brouillon</Badge>;
}

export default async function CardsPage({ searchParams }: PageProps<"/app/cartes">) {
  const ctx = await requireOrgPage();
  const canCreate = can(ctx, "cards.create");
  const sp = await searchParams;
  const showArchived = sp.archives === "1";
  const all = await listCardsForActor(ctx, { includeArchived: true });
  const active = all.filter((c) => c.status !== "archived");
  const visible = showArchived ? all.filter((c) => c.status === "archived") : active;
  const quota = ctx.entitlement.quotas.cards;
  const base = `${appUrl()}/${ctx.organization.slug}`;
  const manage = can(ctx, "cards.manageAll");
  const full = active.length >= quota;

  return (
    <>
      <PageHeader
        title="Cartes"
        description={manage ? `${active.length} / ${quota} carte(s) utilisée(s), brouillons inclus. Les cartes archivées ne comptent pas.` : "Les cartes qui vous sont attribuées."}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {canCreate && !showArchived && !full && <ButtonLink href="/app/cartes/nouvelle">+ Créer une carte</ButtonLink>}
            {canCreate && <Link href="/app/cartes/import" className="text-sm font-semibold text-brand underline">Importer un CSV</Link>}
            <Link href={showArchived ? "/app/cartes" : "/app/cartes?archives=1"} className="text-sm font-semibold text-brand underline">
              {showArchived ? "Cartes actives" : "Archives"}
            </Link>
          </div>
        }
      />

      {canCreate && !showArchived && full && (
        <p className="mb-5 rounded-lg bg-surface p-3 text-sm text-muted">Limite de {quota} carte(s) atteinte. Archivez une carte ou passez à une formule supérieure pour en créer une nouvelle.</p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={showArchived ? "Aucune carte archivée" : "Créez votre première carte"}
          action={canCreate && !showArchived ? <ButtonLink href="/app/cartes/nouvelle">+ Créer une carte</ButtonLink> : undefined}
        >
          {canCreate ? "En deux minutes, répondez à quelques questions ou partez d'un éditeur complet." : "Aucune carte ne vous est encore attribuée."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {visible.map((card) => {
            const parsed = parseDocument(card.draft);
            const doc = parsed.success ? parsed.data : emptyDocument();
            const templateLabel = TEMPLATE_PRESETS[doc.theme.template]?.label ?? doc.theme.template;
            return (
              <li key={card.id} className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 ring-1 ring-line">
                <Link href={`/app/cartes/${card.id}`} aria-label={`Modifier ${card.title}`} className="block">
                  <CardThumbnail doc={doc} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/app/cartes/${card.id}`} className="font-bold hover:underline">{card.title}</Link>
                    {statusBadge(card)}
                    <Badge tone="brand">{templateLabel}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{base}/{card.slug} · modifiée le {formatDate(card.updatedAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <Link href={`/app/cartes/${card.id}`} className="font-semibold text-brand hover:underline">Modifier</Link>
                    <Link href={`/app/cartes/${card.id}/signature`} className="font-semibold text-brand hover:underline">Signature email</Link>
                  </div>
                </div>
                <CardRowActions
                  card={{ id: card.id, status: card.status, disabled: !!card.disabledAt, publicUrl: `${base}/${card.slug}` }}
                  canManage={manage}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
