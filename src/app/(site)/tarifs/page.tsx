import type { Metadata } from "next";
import Link from "next/link";
import { Check, CreditCard, ShieldCheck, RefreshCw } from "lucide-react";
import { listPlans } from "@/lib/billing/service";
import { PricingCards, type PlanCard } from "@/components/billing/PricingCards";
import { Alert } from "@/components/ui";
import { getSettings } from "@/lib/settings/store";
import { JsonLd, pageMeta, breadcrumbLd } from "@/lib/seo";
import { appUrl, brand } from "@/lib/config";

export function generateMetadata(): Metadata {
  return pageMeta({ title: "Tarifs", description: "Essai gratuit 7 jours sans carte bancaire, puis des formules mensuelles ou annuelles. La carte et ses outils dès la formule Solo ; la suite acquisition (mini-site vitrine, relances automatiques) à partir du Pro.", path: "/tarifs" });
}
export const dynamic = "force-dynamic";

const REASSURANCE = [
  { icon: CreditCard, text: "7 jours d'essai gratuit, sans carte bancaire" },
  { icon: RefreshCw, text: "Changez ou résiliez à tout moment" },
  { icon: ShieldCheck, text: "Hébergé en Europe, conçu pour le RGPD" },
];

const FAQ: [string, string][] = [
  ["L'essai est-il vraiment gratuit ?", "Oui : 7 jours, sans carte bancaire. Vous ne payez que si vous décidez de continuer."],
  ["Suis-je engagé ?", "Non. Les formules sont sans engagement au-delà de la période déjà payée ; vous pouvez résilier quand vous voulez."],
  ["Puis-je changer de formule ?", "Oui, à tout moment depuis votre espace. Le montant est ajusté automatiquement."],
  ["Qu'est-ce qui change entre les formules ?", "La formule Solo inclut la carte de visite et tous ses outils (QR, statistiques, formulaire, CRM de prospects, signature email). La suite acquisition — mini-site vitrine et relances automatiques — est incluse à partir du Pro. Les formules supérieures augmentent surtout les quotas (cartes, membres, stockage)."],
  ["Puis-je essayer le mini-site et les relances ?", "Oui : pendant les 7 jours d'essai, toutes les fonctionnalités sont débloquées, mini-site et relances compris. Vous choisissez ensuite la formule adaptée."],
];

export default async function PricingPage() {
  const [plans, settings] = await Promise.all([listPlans(), getSettings()]);
  const demo = plans.some((p) => p.plan.isDemo || p.monthly?.isDemo || p.yearly?.isDemo);
  const popularCode = plans.find((p) => /pro/i.test(p.plan.code))?.plan.code ?? plans[Math.min(1, Math.max(0, plans.length - 1))]?.plan.code;

  const cards: PlanCard[] = plans.map(({ plan, monthly, yearly }) => ({
    code: plan.code,
    name: plan.name,
    description: plan.description,
    cardQuota: plan.cardQuota,
    memberQuota: plan.memberQuota,
    storageQuotaMb: plan.storageQuotaMb,
    monthlyCents: monthly?.amountCents ?? null,
    monthlyTax: monthly?.taxBehavior ?? "",
    yearlyCents: yearly?.amountCents ?? null,
    yearlyTax: yearly?.taxBehavior ?? "",
    popular: plan.code === popularCode,
  }));

  return (
    <>
      <JsonLd data={[breadcrumbLd([{ name: "Accueil", path: "/" }, { name: "Tarifs", path: "/tarifs" }]), ...(demo ? [] : plans.filter((p) => p.monthly?.stripePriceId || p.monthly).map((p) => ({ "@context": "https://schema.org", "@type": "Product", name: `${brand.name} – ${p.plan.name}`, description: p.plan.description || undefined, offers: p.monthly ? { "@type": "Offer", price: (p.monthly.amountCents / 100).toFixed(2), priceCurrency: "EUR", url: `${appUrl()}/tarifs` } : undefined }))) ]} />

      {/* En-tête */}
      <section className="bg-gradient-to-b from-brand-soft to-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-brand ring-1 ring-brand/20">
            Essai gratuit 7 jours · sans carte bancaire
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">Un tarif simple, un outil qui grandit avec vous</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
            La carte de visite numérique et ses outils dès la formule Solo. La <strong className="text-ink">suite acquisition</strong> — mini-site vitrine et relances automatiques — est incluse à partir du <strong className="text-ink">Pro</strong>. Pendant l&apos;essai, vous testez tout.
          </p>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted">
            {REASSURANCE.map((r) => (
              <li key={r.text} className="inline-flex items-center gap-1.5"><r.icon className="h-4 w-4 text-brand" /> {r.text}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-16">
        {demo && <div className="mb-8"><Alert tone="warning" title="Tarifs non définitifs">Les montants affichés sont des valeurs de démonstration. Les tarifs définitifs seront publiés à l&apos;ouverture commerciale.</Alert></div>}

        {cards.length === 0 ? (
          <p className="mt-8 text-center text-muted">Les formules seront bientôt publiées.</p>
        ) : (
          <PricingCards plans={cards} />
        )}

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted">
          {settings.billing.taxNote || "Les modalités de TVA sont précisées sur chaque prix."} Besoin d&apos;un volume supérieur ou d&apos;une facturation sur mesure ? <Link href="/contact" className="font-semibold text-brand underline">Contactez-nous</Link>.
        </p>

        {/* Inclus dès la formule Solo */}
        <section className="mt-14 rounded-3xl bg-surface p-8">
          <h2 className="text-center text-2xl font-extrabold">Inclus dès la formule Solo</h2>
          <ul className="mx-auto mt-6 grid max-w-3xl gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {[
              "Éditeur de carte par blocs, aperçu en direct",
              "QR codes intelligents multi-origines (carte, véhicule, vitrine…)",
              "Statistiques claires, sans cookie de suivi",
              "Formulaire de contact entièrement personnalisable",
              "CRM : réception et suivi de vos prospects (pipeline)",
              "Signature email assortie (Gmail, Outlook, Apple Mail)",
              "Fiche contact vCard + Apple / Google Wallet",
              "Zone d'intervention sur carte",
              "Mises à jour instantanées, QR permanent",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> <span>{f}</span></li>
            ))}
          </ul>
        </section>

        {/* Suite acquisition — à partir du Pro */}
        <section className="mt-6 rounded-3xl bg-gradient-to-br from-brand-soft to-white p-8 ring-1 ring-brand/15">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-sm font-bold text-white">À partir du Pro</span>
            <h2 className="mt-4 text-2xl font-extrabold">Suite acquisition</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted">Les outils qui transforment vos contacts en clients. Débloqués avec la formule Pro et au-delà (et pendant l&apos;essai).</p>
          </div>
          <ul className="mx-auto mt-6 grid max-w-3xl gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {[
              "Mini-site vitrine multi-pages (Accueil, Services, Réalisations, Contact)",
              "Éditeur de site par blocs + modèles par métier",
              "Relances automatiques (email ou tâche de rappel)",
              "Formulaire du mini-site relié au CRM",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> <span>{f}</span></li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="text-center text-2xl font-extrabold">Questions sur les tarifs</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="rounded-xl bg-white p-4 ring-1 ring-line">
                <summary className="cursor-pointer font-semibold">{q}</summary>
                <p className="mt-2 text-sm text-muted">{a}</p>
              </details>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/inscription" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark">
              Démarrer mon essai gratuit
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
