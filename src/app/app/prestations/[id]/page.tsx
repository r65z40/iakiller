import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgPage } from "@/lib/context";
import { getOrderForOrg, listOrderMessages, ORDER_STATUS_LABELS } from "@/lib/services/orders";
import { billingMode } from "@/lib/billing/stripe";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Alert, Badge, PageHeader, Panel } from "@/components/ui";
import { DomainError } from "@/lib/errors";
import { OrderClient } from "./OrderClient";

const STEPS = ["requested", "awaiting_payment", "brief_received", "in_progress", "client_review", "delivered", "closed"];

export default async function OrderPage({ params, searchParams }: PageProps<"/app/prestations/[id]">) {
  const ctx = await requireOrgPage("service.order");
  const { id } = await params;
  const sp = await searchParams;
  let row;
  try {
    row = await getOrderForOrg(ctx, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const { order, offer } = row;
  const messages = await listOrderMessages(order.id, ctx.organization.id);
  const brief = order.brief as Record<string, string>;
  const stepIndex = STEPS.indexOf(order.status === "revisions" ? "client_review" : order.status);

  return (
    <div className="max-w-3xl">
      <PageHeader title={offer.name} description={`Demande du ${formatDateTime(order.createdAt)} · ${formatMoney(order.amountCents, order.currency)}`} actions={<Badge tone="brand">{ORDER_STATUS_LABELS[order.status]}</Badge>} />
      {sp.retour === "paiement" && !order.paidAt && <div className="mb-4"><Alert tone="info">Paiement en cours de confirmation par Stripe. Le statut se mettra à jour automatiquement à réception de la confirmation.</Alert></div>}
      <Panel title="Avancement" className="mb-6">
        <ol className="grid gap-2 sm:grid-cols-7">
          {STEPS.map((s, i) => (
            <li key={s} className={`rounded-lg p-2 text-center text-xs ${i <= stepIndex ? "bg-brand-soft font-semibold text-brand" : "bg-surface text-muted"}`} aria-current={i === stepIndex ? "step" : undefined}>{ORDER_STATUS_LABELS[s]}</li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">Corrections utilisées : {order.revisionsUsed} / {order.includedRevisions}. La carte réalisée reste un brouillon : vous la publiez vous-même après validation (abonnement ou essai actif nécessaire).</p>
        {order.cardId && <p className="mt-2 text-sm"><Link href={`/app/cartes/${order.cardId}`} className="font-semibold text-brand underline">Ouvrir la carte réalisée</Link></p>}
      </Panel>
      <OrderClient orderId={order.id} status={order.status} canPay={(order.status === "requested" || order.status === "awaiting_payment") && billingMode() !== "disabled" && !offer.isDemo && !!offer.stripePriceId} paymentUnavailableReason={billingMode() === "disabled" ? "Paiement non configuré (mode local)." : offer.isDemo || !offer.stripePriceId ? "Tarif de démonstration : paiement fermé." : null} paid={!!order.paidAt} refundRequested={!!order.refundRequestedAt} />
      <Panel title="Brief" className="mt-6">
        <dl className="space-y-3 text-sm">
          {[["Activité", brief.activity], ["Personnes", brief.people], ["Style", brief.style], ["Liens", brief.links], ["Précisions", brief.notes]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt className="font-semibold">{k}</dt><dd className="whitespace-pre-wrap text-muted">{v}</dd></div>
          ))}
        </dl>
      </Panel>
      <Panel title="Échanges" className="mt-6">
        {messages.length === 0 ? <p className="text-sm text-muted">Aucun message.</p> : (
          <ul className="space-y-3">
            {messages.map(({ message, author }) => (
              <li key={message.id} className={`rounded-lg p-3 text-sm ${message.fromPlatform ? "bg-brand-soft" : "bg-surface"}`}>
                <p className="text-xs text-muted">{message.fromPlatform ? "Équipe" : author ?? "Vous"} · {formatDateTime(message.createdAt)}</p>
                <p className="whitespace-pre-wrap">{message.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
