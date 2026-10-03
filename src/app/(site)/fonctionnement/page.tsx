import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Fonctionnement" };

const STEPS = [
  ["Créez votre compte", "Inscription avec votre email, que vous confirmez. L'essai de 7 jours démarre à la création de votre organisation."],
  ["Composez votre carte", "Ajoutez vos coordonnées, une présentation, vos liens, une galerie ou un formulaire. L'aperçu se met à jour en direct ; le brouillon s'enregistre automatiquement."],
  ["Publiez", "La carte devient accessible à l'adresse /votre-entreprise/prenom-nom. Les modifications suivantes restent en brouillon tant que vous ne republiez pas."],
  ["Partagez", "Téléchargez le QR code (PNG ou SVG) pour vos supports imprimés, ou partagez le lien. Le QR reste valable même si vous changez l'adresse de la carte."],
  ["Suivez", "Ouvertures, clics, sources et demandes reçues, dans votre espace."],
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Comment ça marche</h1>
      <ol className="mt-8 space-y-6">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white">{i + 1}</span>
            <div><h2 className="font-bold">{t}</h2><p className="mt-1 text-muted">{d}</p></div>
          </li>
        ))}
      </ol>
      <div className="mt-10 rounded-xl bg-surface p-5 text-sm">
        <h2 className="font-bold">Et après l&apos;essai ?</h2>
        <p className="mt-1 text-muted">Sans abonnement, vos cartes deviennent indisponibles pour les visiteurs, mais votre compte et vos contenus restent accessibles pour souscrire. En cas de résiliation, les cartes restent en ligne jusqu&apos;à la fin de la période payée.</p>
      </div>
      <Link href="/inscription" className="mt-8 inline-block rounded-lg bg-brand px-5 py-3 font-semibold text-white">Commencer l&apos;essai</Link>
    </div>
  );
}
