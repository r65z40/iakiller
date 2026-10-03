import type { Metadata } from "next";
import Link from "next/link";
import { listPlans } from "@/lib/billing/service";
import { PriceTag } from "@/components/billing/PriceTag";
import { Alert } from "@/components/ui";
import { getSettings } from "@/lib/settings/store";

export const metadata: Metadata = { title: "Tarifs" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [plans, settings] = await Promise.all([listPlans(), getSettings()]);
  const demo = plans.some((p) => p.plan.isDemo || p.monthly?.isDemo || p.yearly?.isDemo);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Tarifs</h1>
      <p className="mt-2 text-muted">Essai gratuit de 7 jours, sans carte bancaire. Formules mensuelles ou annuelles, sans engagement au-delà de la période payée.</p>
      {demo && <div className="mt-6"><Alert tone="warning" title="Tarifs non définitifs">Les montants affichés sont des valeurs de démonstration. Les tarifs définitifs seront publiés à l&apos;ouverture commerciale.</Alert></div>}
      {plans.length === 0 ? (
        <p className="mt-8 text-muted">Les formules seront bientôt publiées.</p>
      ) : (
        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {plans.map(({ plan, monthly, yearly }) => (
            <li key={plan.id} className="flex flex-col rounded-2xl p-6 ring-1 ring-line">
              <h2 className="text-xl font-bold">{plan.name}</h2>
              <p className="mt-1 text-sm text-muted">{plan.description}</p>
              <div className="mt-5 space-y-3">
                <PriceTag monthly={monthly} yearly={yearly} interval="month" />
                <div className="border-t border-line pt-3"><PriceTag monthly={monthly} yearly={yearly} interval="year" /></div>
              </div>
              <ul className="my-5 space-y-1 text-sm">
                <li>{plan.cardQuota} carte(s) numérique(s)</li>
                <li>{plan.memberQuota} membre(s)</li>
                <li>{plan.storageQuotaMb >= 1024 ? `${Math.round(plan.storageQuotaMb / 1024)} Go` : `${plan.storageQuotaMb} Mo`} de stockage</li>
                <li>QR code, vCard, formulaire, statistiques</li>
              </ul>
              <Link href="/inscription" className="mt-auto rounded-lg bg-brand px-4 py-3 text-center font-semibold text-white">Commencer l&apos;essai</Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-muted">Toutes les fonctions sont disponibles dans chaque formule ; seuls les quotas changent. {settings.billing.taxNote || "Les modalités de TVA seront précisées sur chaque prix."}</p>
    </div>
  );
}
