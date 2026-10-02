import { requireStaffPage } from "@/lib/context";
import { listPlans } from "@/lib/billing/service";
import { db, schema } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { Badge, Button, PageHeader, Panel } from "@/components/ui";
import { Flash } from "../_lib/Flash";
import { setPriceAction, updateOfferAction, updatePlanAction } from "../_lib/actions";

const input = "mt-1 block min-h-10 w-full rounded-lg border border-line px-3 text-sm";

export default async function AdminPlans({ searchParams }: PageProps<"/admin/plans">) {
  await requireStaffPage("platform.plans.manage");
  const sp = await searchParams;
  const [plans, offers] = await Promise.all([listPlans({ activeOnly: false }), db.select().from(schema.serviceOffer)]);
  return (
    <>
      <PageHeader title="Plans, prix et prestations" description="Montants en euros, stockés en centimes. Les prix Stripe se créent dans le tableau de bord Stripe (mode test d'abord) puis s'associent ici." />
      <Flash sp={sp} />
      <div className="space-y-6">
        {plans.map(({ plan, monthly, yearly }) => (
          <Panel key={plan.id} title={<>{plan.name} {plan.isDemo && <Badge tone="warning">démonstration</Badge>} {!plan.isActive && <Badge>inactif</Badge>}</>}>
            <form action={updatePlanAction} className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="id" value={plan.id} />
              <label className="text-sm font-semibold">Nom<input name="name" defaultValue={plan.name} className={input} /></label>
              <label className="text-sm font-semibold sm:col-span-2">Description<input name="description" defaultValue={plan.description} className={input} /></label>
              <label className="text-sm font-semibold">Cartes<input name="cardQuota" type="number" min={1} defaultValue={plan.cardQuota} className={input} /></label>
              <label className="text-sm font-semibold">Stockage (Mo)<input name="storageQuotaMb" type="number" min={1} defaultValue={plan.storageQuotaMb} className={input} /></label>
              <label className="text-sm font-semibold">Membres<input name="memberQuota" type="number" min={1} defaultValue={plan.memberQuota} className={input} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={plan.isActive} /> Actif</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isDemo" defaultChecked={plan.isDemo} /> Quotas de démonstration (bloque la vente)</label>
              <div><Button size="sm">Enregistrer le plan</Button></div>
            </form>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {(["month", "year"] as const).map((interval) => {
                const p = interval === "month" ? monthly : yearly;
                return (
                  <form key={interval} action={setPriceAction} className="space-y-2 rounded-lg bg-surface p-3">
                    <input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="interval" value={interval} />
                    <p className="text-sm font-bold">{interval === "month" ? "Prix mensuel" : "Prix annuel"} : {p ? formatMoney(p.amountCents) : "non défini"} {p?.isDemo && <Badge tone="warning">démo</Badge>}</p>
                    <label className="block text-sm">Montant (€)<input name="amount" inputMode="decimal" defaultValue={p ? (p.amountCents / 100).toFixed(2) : ""} required className={input} /></label>
                    <label className="block text-sm">Présentation<select name="taxBehavior" defaultValue={p?.taxBehavior === "inclusive" ? "inclusive" : "exclusive"} className={input}><option value="exclusive">HT</option><option value="inclusive">TTC</option></select></label>
                    <label className="block text-sm">Identifiant de prix Stripe<input name="stripePriceId" defaultValue={p?.stripePriceId ?? ""} placeholder="price_…" className={input} /></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isDemo" defaultChecked={p?.isDemo ?? true} /> Prix de démonstration</label>
                    <Button size="sm" variant="secondary">Créer ce prix (remplace l&apos;actuel pour les nouvelles souscriptions)</Button>
                  </form>
                );
              })}
            </div>
          </Panel>
        ))}
        <h2 className="text-lg font-bold">Prestations de création accompagnée</h2>
        {offers.map((o) => (
          <Panel key={o.id} title={<>{o.name} {o.isDemo && <Badge tone="warning">démonstration</Badge>}</>}>
            <form action={updateOfferAction} className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="id" value={o.id} />
              <label className="text-sm font-semibold">Nom<input name="name" defaultValue={o.name} className={input} /></label>
              <label className="text-sm font-semibold sm:col-span-2">Description<input name="description" defaultValue={o.description} className={input} /></label>
              <label className="text-sm font-semibold">Montant (€)<input name="amount" defaultValue={(o.amountCents / 100).toFixed(2)} className={input} /></label>
              <label className="text-sm font-semibold">Séries de corrections incluses<input name="includedRevisions" type="number" min={0} defaultValue={o.includedRevisions} className={input} /></label>
              <label className="text-sm font-semibold">Délai interne (jours)<input name="targetDays" type="number" min={0} defaultValue={o.targetDays ?? ""} className={input} /></label>
              <label className="text-sm font-semibold sm:col-span-2">Identifiant de prix Stripe<input name="stripePriceId" defaultValue={o.stripePriceId ?? ""} className={input} /></label>
              <div className="flex items-center gap-4 text-sm"><label className="flex items-center gap-1"><input type="checkbox" name="isActive" defaultChecked={o.isActive} /> Active</label><label className="flex items-center gap-1"><input type="checkbox" name="isDemo" defaultChecked={o.isDemo} /> Démo</label></div>
              <div><Button size="sm">Enregistrer</Button></div>
            </form>
          </Panel>
        ))}
      </div>
    </>
  );
}
