import Link from "next/link";
import { requireOrgPage } from "@/lib/context";
import { listCardsForActor } from "@/lib/cards/service";
import { can } from "@/lib/permissions";
import { appUrl } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { TEMPLATE_PRESETS } from "@/lib/cards/defaults";
import { Badge, EmptyState, Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { createCardAction } from "../_actions/cards";
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

  return (
    <>
      <PageHeader
        title="Cartes"
        description={manage ? `${active.length} / ${quota} carte(s) utilisée(s), brouillons inclus. Les cartes archivées ne comptent pas.` : "Les cartes qui vous sont attribuées."}
        actions={
<>
            {canCreate && <Link href="/app/cartes/import" className="text-sm font-semibold text-brand underline">Importer un fichier CSV</Link>}
          <Link href={showArchived ? "/app/cartes" : "/app/cartes?archives=1"} className="text-sm font-semibold text-brand underline">
            {showArchived ? "Voir les cartes actives" : "Voir les archives"}
          </Link>
          </>
        }
      />

      {canCreate && !showArchived && (
        <Panel title="Nouvelle carte" className="mb-6">
          {active.length >= quota ? (
            <p className="text-sm text-muted">Limite de {quota} carte(s) atteinte. Archivez une carte ou passez à une formule supérieure.</p>
          ) : (
            <ActionForm action={createCardAction} className="grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
                                <Field label="Nom interne de la carte" htmlFor="title">
                    <Input id="title" name="title" required maxLength={80} placeholder="Ex. Camille Martin – Commerciale" />
                  </Field>
                  <Field label="Modèle" htmlFor="template">
                    <Select id="template" name="template" defaultValue="classique">
                      {Object.entries(TEMPLATE_PRESETS).map(([id, t]) => (
                        <option key={id} value={id}>{t.label}</option>
                      ))}
                    </Select>
                  </Field>
                  <SubmitButton pendingLabel="Création…">Créer</SubmitButton>
            </ActionForm>
          )}
        </Panel>
      )}

      {visible.length === 0 ? (
        <EmptyState title={showArchived ? "Aucune carte archivée" : "Aucune carte pour le moment"}>
          {canCreate ? "Créez votre première carte ci-dessus." : "Aucune carte ne vous est encore attribuée."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {visible.map((card) => (
            <li key={card.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-line">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/app/cartes/${card.id}`} className="font-bold hover:underline">{card.title}</Link>
                  {statusBadge(card)}
                </div>
                <p className="mt-1 truncate text-sm text-muted">
                  {base}/{card.slug} · modifiée le {formatDate(card.updatedAt)}
                </p>
                <Link href={`/app/cartes/${card.id}/signature`} className="mt-1 inline-block text-sm font-semibold text-brand hover:underline">Signature email</Link>
              </div>
              <CardRowActions
                card={{ id: card.id, status: card.status, disabled: !!card.disabledAt, publicUrl: `${base}/${card.slug}` }}
                canManage={manage}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
