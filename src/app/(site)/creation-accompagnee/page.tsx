import type { Metadata } from "next";
import Link from "next/link";
import { listActiveOffers } from "@/lib/services/orders";
import { formatMoney } from "@/lib/format";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Création accompagnée" };
export const dynamic = "force-dynamic";

export default async function GuidedCreation() {
  const offers = await listActiveOffers();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Création accompagnée</h1>
      <p className="mt-2 text-muted">Notre équipe réalise votre carte à partir de vos informations. Vous validez le résultat avant toute publication.</p>
      <ol className="mt-8 list-decimal space-y-3 pl-5">
        <li>Vous créez votre compte et décrivez votre besoin (activité, personnes, style, liens).</li>
        <li>Vous réglez la prestation en ligne. Elle est facturée séparément de l&apos;abonnement et ne l&apos;inclut pas.</li>
        <li>Nous préparons la carte en brouillon dans votre espace, via un accès d&apos;assistance temporaire et journalisé — sans jamais vous demander votre mot de passe.</li>
        <li>Vous la relisez, demandez des corrections si besoin, puis la validez.</li>
        <li>Vous la publiez quand vous le souhaitez (essai ou abonnement actif nécessaire).</li>
      </ol>
      {offers.length > 0 && (
        <div className="mt-8 space-y-3">
          {offers.some((o) => o.isDemo) && <Alert tone="warning">Tarif et conditions de démonstration, non définitifs.</Alert>}
          {offers.map((o) => (
            <div key={o.id} className="rounded-xl p-5 ring-1 ring-line">
              <h2 className="font-bold">{o.name}</h2>
              <p className="text-sm text-muted">{o.description}</p>
              <p className="mt-2 text-lg font-extrabold">{formatMoney(o.amountCents, o.currency)}</p>
              <p className="text-sm text-muted">{o.includedRevisions} série(s) de corrections incluse(s).</p>
            </div>
          ))}
        </div>
      )}
      <Link href="/inscription" className="mt-8 inline-block rounded-lg bg-brand px-5 py-3 font-semibold text-white">Créer mon compte et faire une demande</Link>
    </div>
  );
}
