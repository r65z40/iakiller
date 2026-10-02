import Link from "next/link";
import { and, count, eq, gte, ne } from "drizzle-orm";
import { requireOrgPage } from "@/lib/context";
import { db, schema } from "@/lib/db";
import { can } from "@/lib/permissions";
import { STATE_LABELS } from "@/lib/billing/entitlements";
import { daysAgo, formatDateTime } from "@/lib/format";
import { listCardsForActor } from "@/lib/cards/service";
import { Alert, ButtonLink, PageHeader, Panel } from "@/components/ui";

export default async function Dashboard({ searchParams }: PageProps<"/app">) {
  const ctx = await requireOrgPage();
  const sp = await searchParams;
  const cards = await listCardsForActor(ctx);
  const published = cards.filter((c) => c.status === "published" && !c.disabledAt).length;
  const since = daysAgo(30);
  const allCards = can(ctx, "analytics.viewAll");
  const cardIds = cards.map((c) => c.id);

  const [views] = allCards || cardIds.length
    ? await db
        .select({ n: count() })
        .from(schema.analyticsEvent)
        .where(and(eq(schema.analyticsEvent.organizationId, ctx.organization.id), eq(schema.analyticsEvent.type, "view"), gte(schema.analyticsEvent.occurredAt, since), eq(schema.analyticsEvent.isBot, false), eq(schema.analyticsEvent.isInternal, false)))
    : [{ n: 0 }];
  const [leads] = can(ctx, "leads.viewAll")
    ? await db.select({ n: count() }).from(schema.lead).where(and(eq(schema.lead.organizationId, ctx.organization.id), eq(schema.lead.status, "new")))
    : [{ n: 0 }];
  const [active] = await db.select({ n: count() }).from(schema.card).where(and(eq(schema.card.organizationId, ctx.organization.id), ne(schema.card.status, "archived")));
  const ent = ctx.entitlement;

  return (
    <>
      <PageHeader title={`Bonjour ${ctx.user.name.split(" ")[0]}`} description={ctx.organization.name} actions={can(ctx, "cards.create") && <ButtonLink href="/app/cartes">Gérer les cartes</ButtonLink>} />
      {sp.bienvenue && <div className="mb-6"><Alert tone="success" title="Organisation créée">Votre essai gratuit a démarré. Créez votre première carte depuis la page « Cartes ».</Alert></div>}
      {sp.refus && <div className="mb-6"><Alert tone="warning">Cette page n&apos;est pas accessible avec votre rôle.</Alert></div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Formule"><p className="text-lg font-bold">{ent.planName ?? STATE_LABELS[ent.state]}</p><p className="text-sm text-muted">{ent.until ? `Échéance : ${formatDateTime(ent.until)}` : STATE_LABELS[ent.state]}</p></Panel>
        <Panel title="Cartes"><p className="text-3xl font-extrabold">{active.n}<span className="text-base font-semibold text-muted"> / {ent.quotas.cards}</span></p><p className="text-sm text-muted">{published} publiée(s) et accessible(s)</p></Panel>
        <Panel title="Ouvertures mesurées (30 j)"><p className="text-3xl font-extrabold">{views.n}</p><p className="text-sm text-muted"><Link href="/app/statistiques" className="text-brand underline">Détail et définitions</Link></p></Panel>
        <Panel title="Nouveaux prospects"><p className="text-3xl font-extrabold">{leads.n}</p><p className="text-sm text-muted"><Link href="/app/prospects" className="text-brand underline">Voir les demandes</Link></p></Panel>
      </div>
      <Panel title="Vos cartes récentes" className="mt-6">
        {cards.length === 0 ? <p className="text-sm text-muted">Aucune carte. <Link href="/app/cartes" className="text-brand underline">Créer une carte</Link></p> : (
          <ul className="divide-y divide-line">
            {cards.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/app/cartes/${c.id}`} className="font-semibold hover:underline">{c.title}</Link>
                <span className="text-muted">{c.status === "published" ? "Publiée" : "Brouillon"}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
