import { requireOrgPage } from "@/lib/context";
import { can } from "@/lib/permissions";
import { billingMode } from "@/lib/billing/stripe";
import { getSubscriptionRows, listInvoices, listPlans } from "@/lib/billing/service";
import { STATE_LABELS } from "@/lib/billing/entitlements";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { Alert, Badge, PageHeader, Panel } from "@/components/ui";
import { PlanPicker, SubscriptionControls } from "./BillingClient";

export default async function BillingPage({ searchParams }: PageProps<"/app/abonnement">) {
  const ctx = await requireOrgPage("billing.view");
  const sp = await searchParams;
  const [plans, subs, invoices] = await Promise.all([listPlans(), getSubscriptionRows(ctx.organization.id), listInvoices(ctx.organization.id)]);
  const live = subs.find((s) => s.sub.status !== "canceled" && s.sub.status !== "incomplete_expired") ?? null;
  const ent = ctx.entitlement;
  const mode = billingMode();
  const manage = can(ctx, "billing.manage");
  const demo = plans.some((p) => p.plan.isDemo || p.monthly?.isDemo || p.yearly?.isDemo);

  return (
    <>
      <PageHeader title="Abonnement et factures" description="La facturation est rattachée à l'organisation." />
      <div className="mb-6 space-y-3">
        {sp.retour === "paiement" && (
          <Alert tone="info" title="Paiement en cours de confirmation">
            Stripe nous transmet la confirmation. Vos droits sont activés uniquement à réception de cette confirmation (généralement quelques secondes). Actualisez la page si nécessaire.
          </Alert>
        )}
        {sp.retour === "annule" && <Alert tone="warning">Paiement abandonné : rien n&apos;a été facturé.</Alert>}
        {mode === "disabled" && (
          <Alert tone="warning" title="Mode local : paiement non configuré">
            Aucune clé Stripe n&apos;est configurée. Les souscriptions sont désactivées et aucun paiement n&apos;est simulé.
          </Alert>
        )}
        {mode === "test" && <Alert tone="info">Mode test Stripe : utilisez les cartes de test Stripe, aucun prélèvement réel.</Alert>}
        {demo && <Alert tone="warning" title="Tarifs de démonstration">Les prix et quotas affichés sont des valeurs de démonstration modifiables. La souscription reste fermée tant qu&apos;ils ne sont pas validés.</Alert>}
      </div>

      <Panel title="Situation actuelle" className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={ent.publicAccess ? "success" : "warning"}>{STATE_LABELS[ent.state]}</Badge>
          {ent.planName && <span className="font-semibold">{ent.planName}</span>}
          {ent.until && <span className="text-sm text-muted">Échéance : {formatDateTime(ent.until)}</span>}
        </div>
        <p className="mt-2 text-sm text-muted">Quotas : {ent.quotas.cards} carte(s) · {ent.quotas.storageMb} Mo · {ent.quotas.members} membre(s).</p>
        {live && manage && (
          <div className="mt-4">
            <SubscriptionControls cancelAtPeriodEnd={live.sub.cancelAtPeriodEnd} periodEnd={live.sub.currentPeriodEnd ? formatDateTime(live.sub.currentPeriodEnd) : null} billingEnabled={mode !== "disabled"} />
          </div>
        )}
      </Panel>

      <Panel title={live ? "Changer de formule" : "Choisir une formule"} description="Les montants, la date d'effet et le prorata sont affichés avant toute confirmation." className="mb-6">
        <PlanPicker
          plans={plans.map((p) => ({
            id: p.plan.id,
            name: p.plan.name,
            description: p.plan.description,
            quotas: { cards: p.plan.cardQuota, storageMb: p.plan.storageQuotaMb, members: p.plan.memberQuota },
            monthly: p.monthly && { id: p.monthly.id, amountCents: p.monthly.amountCents, taxBehavior: p.monthly.taxBehavior, sellable: !p.monthly.isDemo && !p.plan.isDemo && !!p.monthly.stripePriceId },
            yearly: p.yearly && { id: p.yearly.id, amountCents: p.yearly.amountCents, taxBehavior: p.yearly.taxBehavior, sellable: !p.yearly.isDemo && !p.plan.isDemo && !!p.yearly.stripePriceId },
          }))}
          currentPriceId={live?.price?.id ?? null}
          hasLive={!!live}
          canManage={manage}
          billingEnabled={mode !== "disabled"}
        />
      </Panel>

      <Panel title="Factures">
        {invoices.length === 0 ? (
          <p className="text-sm text-muted">Aucune facture pour le moment.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted"><tr><th className="py-2">Date</th><th>Numéro</th><th>Montant</th><th>Statut</th><th></th></tr></thead>
            <tbody className="divide-y divide-line">
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className="py-2">{formatDate(i.issuedAt)}</td>
                  <td>{i.number ?? "—"}</td>
                  <td>{formatMoney(i.amountDueCents, i.currency)}</td>
                  <td>{i.status === "paid" ? "Payée" : i.status === "open" ? "À payer" : i.status}</td>
                  <td className="text-right">{i.hostedInvoiceUrl && <a href={i.hostedInvoiceUrl} target="_blank" rel="noopener" className="text-brand underline">Voir</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {manage && mode !== "disabled" && <p className="mt-3 text-sm text-muted">Moyen de paiement, adresse de facturation et historique complet : via le portail sécurisé Stripe ci-dessus.</p>}
      </Panel>
    </>
  );
}
