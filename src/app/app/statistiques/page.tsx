import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { requireOrgPage } from "@/lib/context";
import { breakdown, dailySeries, topCards, totals, type StatsFilter } from "@/lib/analytics/queries";
import { EVENT_TYPES } from "@/lib/analytics/service";
import { analyticsConfig } from "@/lib/analytics/config";
import { listCardsForActor } from "@/lib/cards/service";
import { can } from "@/lib/permissions";
import { db, schema } from "@/lib/db";
import { Alert, PageHeader, Panel } from "@/components/ui";
import { DailyChart } from "./DailyChart";

const PERIODS = { "7": 7, "30": 30, "90": 90, "365": 365 } as const;
const SOURCE_LABELS: Record<string, string> = { qr: "Lien du QR code", direct: "Lien direct / partage", campaign: "Campagne (UTM)" };
const DEVICE_LABELS: Record<string, string> = { mobile: "Mobile", tablet: "Tablette", desktop: "Ordinateur" };

function pct(v: number | null) {
  return v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")} %`;
}
function delta(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? "nouveau" : "—";
  const d = ((cur - prev) / prev) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(0)} % vs période précédente`;
}

export default async function StatsPage({ searchParams }: PageProps<"/app/statistiques">) {
  const ctx = await requireOrgPage();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const periodKey = (one(sp.periode) ?? "30") as keyof typeof PERIODS;
  const days = PERIODS[periodKey] ?? 30;
  const now = new Date();
  const filter: StatsFilter = { from: new Date(now.getTime() - days * 86400_000), to: now, cardId: one(sp.carte) || null, memberUserId: one(sp.membre) || null, includeInternal: one(sp.internes) === "1" };
  const prevFilter: StatsFilter = { ...filter, from: new Date(filter.from.getTime() - days * 86400_000), to: filter.from };

  const [cur, prev, series, types, sources, devices, browsers, countries, campaigns, top, cards] = await Promise.all([
    totals(ctx, filter), totals(ctx, prevFilter), dailySeries(ctx, filter), breakdown(ctx, filter, "type"), breakdown(ctx, filter, "source"),
    breakdown(ctx, filter, "device"), breakdown(ctx, filter, "browser"), breakdown(ctx, filter, "country"), breakdown(ctx, filter, "utmCampaign"), topCards(ctx, filter), listCardsForActor(ctx, { includeArchived: true }),
  ]);
  const members = can(ctx, "analytics.viewAll")
    ? await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.membership).innerJoin(schema.user, eq(schema.user.id, schema.membership.userId)).where(and(eq(schema.membership.organizationId, ctx.organization.id)))
    : [];
  const cfg = analyticsConfig();
  const qs = new URLSearchParams(Object.entries({ periode: periodKey, carte: filter.cardId ?? "", membre: filter.memberUserId ?? "", internes: filter.includeInternal ? "1" : "" }).filter(([, v]) => v) as [string, string][]).toString();

  const list = (rows: { key: string; count: number }[], labels?: Record<string, string>) =>
    rows.length === 0 ? <p className="text-sm text-muted">Aucune donnée.</p> : (
      <ul className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex justify-between gap-3"><span>{labels && Object.hasOwn(labels, r.key) ? labels[r.key] : r.key}</span><span className="font-semibold tabular-nums">{r.count}</span></li>
        ))}
      </ul>
    );

  return (
    <>
      <PageHeader title="Statistiques" description="Fuseau horaire : Europe/Paris. Les chiffres sont des mesures, avec leurs limites (voir les définitions en bas de page)." actions={<a href={`/app/statistiques/export?${qs}`} className="text-sm font-semibold text-brand underline">Exporter en CSV</a>} />
      {!cfg.enabled && <div className="mb-4"><Alert tone="warning">La mesure d&apos;audience est désactivée sur cette plateforme.</Alert></div>}

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 ring-1 ring-line" method="get">
        <label className="text-sm font-semibold">Période
          <select name="periode" defaultValue={periodKey} className="mt-1 block min-h-10 rounded-lg border border-line px-2">
            <option value="7">7 derniers jours</option><option value="30">30 derniers jours</option><option value="90">90 derniers jours</option><option value="365">12 derniers mois</option>
          </select>
        </label>
        <label className="text-sm font-semibold">Carte
          <select name="carte" defaultValue={filter.cardId ?? ""} className="mt-1 block min-h-10 max-w-60 rounded-lg border border-line px-2">
            <option value="">Toutes</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        {members.length > 0 && (
          <label className="text-sm font-semibold">Membre
            <select name="membre" defaultValue={filter.memberUserId ?? ""} className="mt-1 block min-h-10 rounded-lg border border-line px-2">
              <option value="">Tous</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="internes" value="1" defaultChecked={filter.includeInternal} className="h-4 w-4" /> Inclure les visites internes</label>
        <button type="submit" className="min-h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white">Appliquer</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Ouvertures mesurées"><p className="text-3xl font-extrabold tabular-nums">{cur.views}</p><p className="text-xs text-muted">{delta(cur.views, prev.views)}</p></Panel>
        <Panel title="Ouvertures avec au moins une action"><p className="text-3xl font-extrabold tabular-nums">{cur.actionViews}</p><p className="text-xs text-muted">Taux de clic : {pct(cur.clickRate)} (précédent : {pct(prev.clickRate)})</p></Panel>
        <Panel title="Formulaires envoyés"><p className="text-3xl font-extrabold tabular-nums">{cur.leads}</p><p className="text-xs text-muted">Taux de formulaire : {pct(cur.formRate)}</p></Panel>
        <Panel title="Passages par le lien du QR"><p className="text-3xl font-extrabold tabular-nums">{sources.find((s) => s.key === "qr")?.count ?? 0}</p><p className="text-xs text-muted">Ouvertures arrivées par le lien du QR code</p></Panel>
      </div>

      <Panel title="Ouvertures mesurées par jour" className="mt-6"><DailyChart data={series} /></Panel>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Actions">{list(types.filter((t) => t.key !== "view"), EVENT_TYPES as unknown as Record<string, string>)}</Panel>
        <Panel title="Sources des ouvertures">{list(sources, SOURCE_LABELS)}</Panel>
        <Panel title="Cartes les plus consultées">
          {top.length === 0 ? <p className="text-sm text-muted">Aucune donnée.</p> : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted"><tr><th>Carte</th><th className="text-right">Ouvertures</th><th className="text-right">Taux de clic</th><th className="text-right">Formulaires</th></tr></thead>
              <tbody>{top.map((t) => <tr key={t.cardId}><td><Link href={`/app/statistiques?periode=${periodKey}&carte=${t.cardId}`} className="hover:underline">{t.title}</Link></td><td className="text-right tabular-nums">{t.views}</td><td className="text-right tabular-nums">{pct(t.views ? t.actionViews / t.views : null)}</td><td className="text-right tabular-nums">{t.leads}</td></tr>)}</tbody>
            </table>
          )}
        </Panel>
        <Panel title="Campagnes et origines QR">{campaigns.filter((c) => c.key !== "—").length === 0 ? <p className="text-sm text-muted">Aucune donnée. Créez des origines de QR (onglet « QR code et partage » d&apos;une carte) ou ajoutez un paramètre utm_campaign à vos liens.</p> : list(campaigns.filter((c) => c.key !== "—"))}</Panel>
        <Panel title="Appareils">{list(devices, DEVICE_LABELS)}</Panel>
        <Panel title="Navigateurs">{list(browsers)}</Panel>
        <Panel title="Pays (si fourni par l'hébergeur)">{list(countries)}</Panel>
      </div>

      <Panel title="Définitions et limites" className="mt-6">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li><strong>Ouverture mesurée</strong> : affichage d&apos;une carte publiée où la mesure a pu s&apos;exécuter (JavaScript actif{cfg.requireConsent ? ", accord du visiteur" : ""}). Les robots détectés sont exclus, sans garantie de filtrage parfait ; les visites des membres connectés et de l&apos;équipe sont exclues par défaut.</li>
          <li><strong>Taux de clic</strong> = ouvertures mesurées ayant au moins une action ÷ ouvertures mesurées.</li>
          <li><strong>Taux de formulaire</strong> = formulaires envoyés avec succès ÷ ouvertures mesurées. Il ne mesure pas l&apos;ensemble de vos conversions commerciales.</li>
          <li>Un clic « Appeler » ou « Email » mesure une intention, pas un appel passé ni un message envoyé. Un téléchargement de vCard ne prouve pas l&apos;ajout aux contacts.</li>
          <li>Un passage par le lien du QR code ne prouve pas un scan physique (le lien peut être partagé).</li>
          <li><strong>Origines QR</strong> : si vous créez plusieurs QR pour une même carte (ex. « Carte de visite », « Véhicule »), le support d&apos;où vient chaque ouverture apparaît dans « Campagnes et origines QR ».</li>
          <li>Aucun « visiteur unique » n&apos;est calculé : aucun identifiant persistant n&apos;est déposé sur l&apos;appareil du visiteur.</li>
        </ul>
      </Panel>
    </>
  );
}
