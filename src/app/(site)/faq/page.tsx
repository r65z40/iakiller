import type { Metadata } from "next";

export const metadata: Metadata = { title: "Questions fréquentes" };

const QA: [string, string][] = [
  ["Faut-il une carte bancaire pour l'essai ?", "Non. L'essai de 7 jours démarre à la création de votre organisation et permet jusqu'à 3 cartes. Rien n'est facturé automatiquement à la fin."],
  ["Que se passe-t-il à la fin de l'essai sans abonnement ?", "Vos cartes deviennent indisponibles pour les visiteurs (le QR code affiche une page d'indisponibilité). Votre compte et vos contenus restent accessibles pour souscrire ; ils ne sont pas supprimés automatiquement à cette date."],
  ["Et si je résilie ?", "Vos cartes restent en ligne jusqu'à la fin de la période déjà payée, puis deviennent indisponibles. Il n'y a pas de maintien gratuit automatique."],
  ["Le QR code change-t-il si je modifie ma carte ?", "Non. Il pointe vers un lien permanent qui mène toujours à l'adresse actuelle de la carte, même si vous la renommez."],
  ["Vendez-vous des cartes physiques ou NFC ?", "Non, uniquement des cartes numériques. Vous pouvez imprimer vous-même le QR code sur vos supports."],
  ["Puis-je utiliser mon propre nom de domaine ?", "Pas dans cette version : les cartes sont publiées à l'adresse du service, sous la forme /entreprise/personne."],
  ["Mes cartes apparaissent-elles sur Google ?", "Par défaut, non : l'indexation est désactivée. Le propriétaire de l'organisation peut l'activer. Aucun annuaire public des cartes n'est proposé."],
  ["Les statistiques sont-elles exactes ?", "Ce sont des mesures avec des limites, expliquées dans votre espace : un clic « Appeler » mesure une intention, pas un appel passé ; les robots sont filtrés sans garantie de perfection ; aucun « visiteur unique » n'est calculé."],
  ["Qui voit les demandes envoyées par le formulaire ?", "Uniquement les membres autorisés de votre organisation. Le visiteur est informé de la destination de ses données ; l'accord marketing est séparé et décoché par défaut."],
  ["Comment se passe la création accompagnée ?", "Vous envoyez un brief et réglez la prestation ; nous préparons un brouillon que vous validez avant publication. La prestation n'inclut pas l'abonnement."],
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Questions fréquentes</h1>
      <div className="mt-8 space-y-3">
        {QA.map(([q, a]) => (
          <details key={q} className="rounded-xl p-4 ring-1 ring-line">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-2 text-muted">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
