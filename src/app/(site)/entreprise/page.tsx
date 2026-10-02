import type { Metadata } from "next";
import Link from "next/link";
import { DemoCard } from "@/components/site/DemoCard";

export const metadata: Metadata = { title: "Offre entreprise" };

const FEATURES = [
  ["Gestion centralisée", "Créez et attribuez les cartes de vos collaborateurs depuis un seul espace."],
  ["Charte graphique imposée", "Couleurs, police, logo et nom de société verrouillables : chacun modifie ses coordonnées, pas la charte."],
  ["Rôles clairs", "Propriétaire, gestionnaires et collaborateurs ; la facturation peut être déléguée explicitement."],
  ["Départ d'un salarié", "Retirez l'accès et désactivez ses cartes immédiatement, QR code compris."],
  ["Statistiques par carte et par membre", "Comparez les cartes, filtrez par collaborateur, exportez en CSV."],
  ["Prospects partagés", "Les demandes reçues sont visibles par les personnes autorisées uniquement."],
];

export default function EnterprisePage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1fr_380px]">
      <div>
        <h1 className="text-3xl font-extrabold">Pour les équipes et les entreprises</h1>
        <p className="mt-2 text-muted">Une image cohérente pour toute votre équipe, sans dépendre de chaque salarié.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {FEATURES.map(([t, d]) => <li key={t} className="rounded-xl p-5 ring-1 ring-line"><h2 className="font-bold">{t}</h2><p className="mt-1 text-sm text-muted">{d}</p></li>)}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/tarifs" className="rounded-lg bg-brand px-5 py-3 font-semibold text-white">Voir les formules</Link>
          <Link href="/contact" className="rounded-lg px-5 py-3 font-semibold ring-1 ring-line">Nous écrire</Link>
        </div>
      </div>
      <div><DemoCard id="entreprise" /><p className="mt-2 text-center text-xs text-muted">Exemple fictif, modèle « Entreprise ».</p></div>
    </div>
  );
}
