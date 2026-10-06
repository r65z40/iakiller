import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";

export function generateMetadata(): Metadata {
  return pageMeta({ title: "Comment ça marche", description: "De la carte de visite numérique au mini-site vitrine, au CRM et aux relances automatiques : découvrez tout ce que la plateforme sait faire, étape par étape.", path: "/fonctionnement" });
}

const STEPS = [
  ["Créez votre compte", "Inscription avec votre email, que vous confirmez. L'essai de 7 jours démarre à la création de votre organisation — toutes les fonctionnalités débloquées, sans carte bancaire."],
  ["Composez votre carte (ou votre mini-site)", "Ajoutez vos coordonnées, une présentation, vos liens, une galerie, un avant/après, un formulaire sur mesure… en glisser-déposer. Le même éditeur construit un mini-site vitrine multi-pages."],
  ["Publiez", "La carte devient accessible à l'adresse /votre-entreprise/prenom-nom, le mini-site sur /s/votre-entreprise/votre-site. Les modifications restent en brouillon tant que vous ne republiez pas."],
  ["Partagez & captez", "QR code (PNG/SVG) à imprimer, lien à partager. Un QR peut pointer vers la carte, un bloc précis, un mini-site ou une campagne temporaire. Les demandes arrivent dans votre espace et par email."],
  ["Suivez & relancez", "Statistiques claires (ouvertures, clics, origines des QR, vues de mini-sites), CRM pour faire avancer chaque prospect, et relances automatiques pour ne rien laisser sans suite."],
];

const CARD_FEATURES = [
  "Éditeur par blocs, aperçu mobile/ordinateur en direct",
  "QR codes intelligents multi-origines (carte, véhicule, vitrine…)",
  "Formulaire de contact entièrement personnalisable",
  "Galerie, avant/après, horaires, zone d'intervention, vidéo, avis",
  "Fiche contact vCard + Apple / Google Wallet",
  "Signature email assortie (Gmail, Outlook, Apple Mail)",
  "Statistiques claires, sans cookie de suivi",
];

const MARKETING_FEATURES = [
  "Mini-site vitrine multi-pages (Accueil, Services, Réalisations, Contact)",
  "Modèles de site par métier, éditeur par blocs",
  "CRM : pipeline de prospects, tâches, étiquettes, responsables",
  "Relances automatiques (email ou tâche de rappel)",
  "QR intelligent pouvant pointer vers un mini-site",
];

const TEAM_FEATURES = [
  "Charte graphique commune, champs verrouillés",
  "Import CSV des salariés, rôles et délégation de facturation",
  "Désactivation immédiate au départ d'un collaborateur",
  "Statistiques par carte et par membre, export CSV",
];

function FeatureCard({ title, badge, items }: { title: string; badge?: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-line">
      <div className="flex items-center gap-2">
        <h3 className="font-bold">{title}</h3>
        {badge && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-muted">
        {items.map((i) => <li key={i} className="flex items-start gap-2"><span aria-hidden className="mt-0.5 text-brand">✓</span> <span>{i}</span></li>)}
      </ul>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Comment ça marche</h1>
      <p className="mt-2 max-w-2xl text-muted">Bien plus qu&apos;une carte de visite : un outil complet pour vous faire connaître, capter des demandes et les transformer en clients.</p>

      <ol className="mt-10 space-y-6">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white">{i + 1}</span>
            <div><h2 className="font-bold">{t}</h2><p className="mt-1 text-muted">{d}</p></div>
          </li>
        ))}
      </ol>

      <h2 className="mt-14 text-2xl font-extrabold">Tout ce que la plateforme sait faire</h2>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <FeatureCard title="La carte de visite" items={CARD_FEATURES} />
        <FeatureCard title="Acquisition & marketing" badge="Pro" items={MARKETING_FEATURES} />
        <FeatureCard title="Équipes & entreprises" items={TEAM_FEATURES} />
      </div>
      <p className="mt-4 text-sm text-muted">La carte et ses outils sont inclus dès la formule Solo. La suite acquisition (mini-site vitrine, relances automatiques) est incluse à partir du Pro — et pendant tout l&apos;essai.</p>

      <div className="mt-10 rounded-xl bg-surface p-5 text-sm">
        <h2 className="font-bold">Et après l&apos;essai ?</h2>
        <p className="mt-1 text-muted">Sans abonnement, vos cartes et mini-sites deviennent indisponibles pour les visiteurs, mais votre compte et vos contenus restent accessibles pour souscrire. En cas de résiliation, tout reste en ligne jusqu&apos;à la fin de la période payée.</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/inscription" className="inline-block rounded-lg bg-brand px-5 py-3 font-semibold text-white">Commencer l&apos;essai gratuit</Link>
        <Link href="/tarifs" className="inline-block rounded-lg px-5 py-3 font-semibold ring-1 ring-line">Voir les tarifs</Link>
      </div>
    </div>
  );
}
