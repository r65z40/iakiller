import Link from "next/link";
import { brand } from "@/lib/config";
import { DemoCard } from "@/components/site/DemoCard";

const POINTS = [
  ["Une carte toujours à jour", "Changement de numéro, nouveau poste : modifiez la carte, le QR code imprimé reste valable."],
  ["Prête à partager", "Lien court, QR code PNG ou SVG à imprimer, et fiche contact (vCard) à enregistrer en un geste."],
  ["Pensée pour le mobile", "Grands boutons d'appel et d'email, lisible au soleil, rapide même en 4G faible."],
  ["Des demandes de contact", "Formulaire intégré, demandes reçues dans votre espace, sans abonnement marketing imposé au visiteur."],
  ["Statistiques expliquées", "Ouvertures, clics et sources, avec la définition de chaque chiffre et ses limites."],
  ["Pour toute l'équipe", "Charte graphique commune, champs verrouillés, désactivation immédiate d'un salarié sortant."],
];

export default function Home() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-soft to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">La carte de visite numérique des artisans, indépendants et PME.</h1>
            <p className="mt-5 text-lg text-muted">Créez votre carte en quelques minutes avec un éditeur simple, partagez-la par QR code ou par lien, et recevez des demandes de contact. Ou confiez sa création à notre équipe.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/inscription" className="rounded-lg bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark">Essayer 7 jours gratuitement</Link>
              <Link href="/modeles" className="rounded-lg bg-white px-5 py-3 font-semibold ring-1 ring-line hover:bg-surface">Voir des exemples</Link>
            </div>
            <p className="mt-4 text-sm text-muted">Sans carte bancaire · jusqu&apos;à 3 cartes pendant l&apos;essai · rien n&apos;est facturé automatiquement à la fin.</p>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <DemoCard id="classique" />
            <p className="mt-2 text-center text-xs text-muted">Exemple fictif réalisé avec {brand.name}.</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-extrabold">Ce que vous obtenez</h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {POINTS.map(([t, d]) => (
            <li key={t} className="rounded-xl p-5 ring-1 ring-line">
              <h3 className="font-bold">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-12">
          <div>
            <h2 className="text-2xl font-extrabold">Pas le temps de la faire vous-même ?</h2>
            <p className="mt-2 text-muted">Envoyez-nous un brief : nous réalisons la carte, vous la validez avant toute publication.</p>
          </div>
          <Link href="/creation-accompagnee" className="rounded-lg bg-ink px-5 py-3 font-semibold text-white">Découvrir la création accompagnée</Link>
        </div>
      </section>
    </>
  );
}
