import Link from "next/link";
import { requireStaffPage } from "@/lib/context";
import { platformMetrics } from "@/lib/admin/service";
import { launchBlockers } from "@/lib/billing/service";
import { billingMode } from "@/lib/billing/stripe";
import { emailMode } from "@/lib/email/send";
import { analyticsConfig } from "@/lib/analytics/config";
import { formatMoney } from "@/lib/format";
import { graceDays } from "@/lib/config";
import { Alert, PageHeader, Panel } from "@/components/ui";

export default async function AdminHome() {
  const staff = await requireStaffPage();
  const [m, blockers] = await Promise.all([platformMetrics(staff, 30), launchBlockers()]);
  const a = analyticsConfig();
  const tile = (label: string, value: string, hint?: string) => (
    <Panel title={label}><p className="text-3xl font-extrabold tabular-nums">{value}</p>{hint && <p className="text-xs text-muted">{hint}</p>}</Panel>
  );
  return (
    <>
      <PageHeader title="Tableau de bord plateforme" description="Indicateurs calculés en direct depuis la base, sur 30 jours. Aucune donnée de démonstration n'est injectée." />
      <p className="mb-4 text-sm"><Link href="/admin/reglages" className="font-semibold text-brand underline">Réglages de la plateforme</Link> : marque, domaine, société, tarification, conservation, création accompagnée, validations juridiques.</p>
      {blockers.length > 0 && (
        <div className="mb-6"><Alert tone="warning" title={`Lancement commercial bloqué (${blockers.length} point(s))`}><ul className="mt-1 list-disc pl-5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul></Alert></div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile("Organisations", String(m.organizations))}
        {tile("Abonnements payants actifs", String(m.activePaying), "active, trialing ou past_due")}
        {tile("MRR indicatif", formatMoney(m.mrrCents), "hors taxes, remises et prestations")}
        {tile("Conversion d'essai", m.trialConversion === null ? "—" : `${Math.round(m.trialConversion * 100)} %`, `${m.trialsStarted} essai(s) démarré(s)`)}
        {tile("Résiliations effectives", String(m.cancellations), `${m.cancellationsScheduled} programmée(s)`)}
        {tile("Prestations payées", String(m.serviceOrdersPaid), formatMoney(m.serviceRevenueCents) + " (séparé du MRR)")}
        {tile("Cartes publiées", String(m.publishedCards))}
        {tile("Webhooks en échec", String(m.failedBillingEvents), "à examiner dans Facturation")}
      </div>
      <Panel title="Configuration (lecture seule, sans secrets)" className="mt-6">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold">Paiement</dt><dd>{billingMode() === "disabled" ? "désactivé (mode local)" : billingMode() === "test" ? "Stripe – mode test" : "Stripe – PRODUCTION"}</dd></div>
          <div><dt className="font-semibold">Emails</dt><dd>{emailMode() === "log" ? "journalisés, non envoyés" : "SMTP réel"}</dd></div>
          <div><dt className="font-semibold">Stockage</dt><dd>{process.env.STORAGE_DRIVER === "s3" ? "S3 compatible" : "disque local"}</dd></div>
          <div><dt className="font-semibold">Mesure d&apos;audience</dt><dd>{a.enabled ? `active${a.requireConsent ? ", avec consentement préalable" : ", sans traceur"}` : "désactivée"} · conservation brute {a.rawRetentionDays} j</dd></div>
          <div><dt className="font-semibold">Délai de grâce impayé</dt><dd>{graceDays()} jour(s)</dd></div>
        </dl>
      </Panel>
    </>
  );
}
