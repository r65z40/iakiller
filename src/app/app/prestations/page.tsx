import Link from "next/link";
import { requireOrgPage } from "@/lib/context";
import { listActiveOffers, listOrdersForOrg, ORDER_STATUS_LABELS } from "@/lib/services/orders";
import { formatDate, formatMoney } from "@/lib/format";
import { Alert, Badge, Field, Input, PageHeader, Panel, Select, Textarea } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { createServiceOrderAction } from "../_actions/billing";

export default async function ServicesPage() {
  const ctx = await requireOrgPage("service.order");
  const [offers, orders] = await Promise.all([listActiveOffers(), listOrdersForOrg(ctx)]);
  return (
    <>
      <PageHeader title="Création accompagnée" description="Notre équipe réalise votre carte à partir de votre brief. Cette prestation est facturée séparément et n'inclut pas d'abonnement." />
      {orders.length > 0 && (
        <Panel title="Vos demandes" className="mb-6">
          <ul className="divide-y divide-line">
            {orders.map(({ order, offer }) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <Link href={`/app/prestations/${order.id}`} className="font-semibold hover:underline">{offer.name} · {formatDate(order.createdAt)}</Link>
                <Badge tone={order.status === "client_review" ? "brand" : "neutral"}>{ORDER_STATUS_LABELS[order.status]}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel title="Nouvelle demande">
        {offers.length === 0 ? (
          <p className="text-sm text-muted">Aucune prestation n&apos;est proposée pour le moment.</p>
        ) : (
          <ActionForm action={createServiceOrderAction} className="space-y-4">
            {offers.some((o) => o.isDemo) && <Alert tone="warning">Tarifs et conditions de démonstration : le paiement reste fermé tant qu&apos;ils ne sont pas validés.</Alert>}
            <Field label="Prestation" htmlFor="offerId">
              <Select id="offerId" name="offerId" required>
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} — {formatMoney(o.amountCents, o.currency)} · {o.includedRevisions} série(s) de corrections incluse(s)</option>
                ))}
              </Select>
            </Field>
            <Field label="Votre activité" htmlFor="activity" hint="Métier, zone d'intervention, clientèle, points forts.">
              <Textarea id="activity" name="activity" rows={4} required minLength={10} maxLength={3000} />
            </Field>
            <Field label="Personnes concernées" htmlFor="people" hint="Nom, fonction et coordonnées à faire figurer pour chaque carte.">
              <Textarea id="people" name="people" rows={3} maxLength={3000} />
            </Field>
            <Field label="Style souhaité" htmlFor="style"><Input id="style" name="style" maxLength={3000} placeholder="Sobre, chaleureux, couleurs de votre logo…" /></Field>
            <Field label="Liens utiles" htmlFor="links"><Textarea id="links" name="links" rows={2} maxLength={3000} placeholder="Site, réseaux, avis clients…" /></Field>
            <Field label="Autres précisions" htmlFor="notes"><Textarea id="notes" name="notes" rows={2} maxLength={3000} /></Field>
            <p className="text-sm text-muted">Vos fichiers (logo, photos) peuvent être déposés dans « Médias » : l&apos;équipe y aura accès pendant la réalisation, via un accès d&apos;assistance journalisé. Nous ne vous demanderons jamais votre mot de passe.</p>
            <SubmitButton pendingLabel="Envoi…">Envoyer la demande</SubmitButton>
          </ActionForm>
        )}
      </Panel>
    </>
  );
}
