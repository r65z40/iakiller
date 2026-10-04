import { requireStaffPage } from "@/lib/context";
import { listPromoCodes } from "@/lib/billing/promos";
import { billingMode } from "@/lib/billing/stripe";
import { formatMoney, formatDateTime } from "@/lib/format";
import { Alert, Badge, Button, PageHeader, Panel } from "@/components/ui";
import { Flash } from "../_lib/Flash";
import { createPromoAction, togglePromoAction } from "./actions";

export const dynamic = "force-dynamic";

const input = "mt-1 block min-h-10 w-full rounded-lg border border-line px-3 text-sm";

function reduction(p: Awaited<ReturnType<typeof listPromoCodes>>[number]) {
  return p.kind === "percent" ? `−${p.percentOff}%` : `−${formatMoney(p.amountOffCents ?? 0)}`;
}
function durationLabel(p: Awaited<ReturnType<typeof listPromoCodes>>[number]) {
  if (p.duration === "forever") return "à chaque échéance";
  if (p.duration === "repeating") return `pendant ${p.durationMonths} mois`;
  return "1re échéance";
}

export default async function AdminPromotions({ searchParams }: PageProps<"/admin/promotions">) {
  await requireStaffPage("platform.plans.manage");
  const sp = await searchParams;
  const mode = billingMode();
  const codes = await listPromoCodes(mode !== "disabled");

  return (
    <>
      <PageHeader title="Codes promo" description="Réductions appliquées par Stripe au paiement. Le client saisit le code dans le champ « code promo » de la page de paiement." />
      <Flash sp={sp} />

      {mode === "disabled" && (
        <div className="mb-6"><Alert tone="warning" title="Paiement non configuré">Renseignez la clé Stripe (variable d&apos;environnement) pour créer des codes promo. Sans Stripe, aucun code ne peut être créé ni appliqué.</Alert></div>
      )}
      {mode === "test" && <div className="mb-6"><Alert tone="warning" title="Mode test Stripe">Les codes créés sont des codes de test Stripe.</Alert></div>}

      <Panel title="Créer un code promo" className="mb-6">
        <form action={createPromoAction} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Code<input name="code" required maxLength={40} placeholder="BIENVENUE20" className={`${input} uppercase`} /></label>
          <label className="block text-sm font-semibold">Description (interne)<input name="description" maxLength={300} className={input} /></label>
          <label className="block text-sm font-semibold">Type de réduction
            <select name="kind" className={input}>
              <option value="percent">Pourcentage (%)</option>
              <option value="amount">Montant fixe (€)</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">Pourcentage<input name="percentOff" type="number" min={1} max={100} placeholder="20" className={input} /></label>
            <label className="block text-sm font-semibold">Montant €<input name="amountOff" type="number" min={0} step="0.01" placeholder="5" className={input} /></label>
          </div>
          <label className="block text-sm font-semibold">Application
            <select name="duration" className={input}>
              <option value="once">1re échéance seulement</option>
              <option value="repeating">Plusieurs mois</option>
              <option value="forever">À chaque échéance</option>
            </select>
          </label>
          <label className="block text-sm font-semibold">Nombre de mois (si « plusieurs mois »)<input name="durationMonths" type="number" min={1} placeholder="3" className={input} /></label>
          <label className="block text-sm font-semibold">Limite d&apos;utilisations (facultatif)<input name="maxRedemptions" type="number" min={1} placeholder="illimité" className={input} /></label>
          <label className="block text-sm font-semibold">Date d&apos;expiration (facultatif)<input name="expiresAt" type="date" className={input} /></label>
          <div className="sm:col-span-2"><Button size="sm" disabled={mode === "disabled"}>Créer le code</Button></div>
          <p className="text-xs text-muted sm:col-span-2">Indiquez le pourcentage OU le montant selon le type choisi. « 1re échéance » = la réduction s&apos;applique au premier paiement ; « plusieurs mois » = pendant N mois ; « à chaque échéance » = en continu.</p>
        </form>
      </Panel>

      <Panel title={`Codes existants (${codes.length})`}>
        {codes.length === 0 ? (
          <p className="text-sm text-muted">Aucun code pour le moment.</p>
        ) : (
          <ul className="divide-y divide-line">
            {codes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-surface px-2 py-0.5 font-bold">{p.code}</code>
                    <Badge tone="brand">{reduction(p)}</Badge>
                    {p.active ? <Badge tone="success">Actif</Badge> : <Badge tone="danger">Inactif</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {durationLabel(p)} · {p.timesRedeemed} utilisation(s){p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}
                    {p.expiresAt ? ` · expire le ${formatDateTime(p.expiresAt)}` : ""}
                    {p.description ? ` · ${p.description}` : ""}
                  </p>
                </div>
                <form action={togglePromoAction.bind(null, p.id, !p.active)}>
                  <Button size="sm" variant={p.active ? "ghost" : "secondary"}>{p.active ? "Désactiver" : "Réactiver"}</Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
