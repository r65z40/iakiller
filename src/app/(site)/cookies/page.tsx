import type { Metadata } from "next";
import { getSettings } from "@/lib/settings/store";
import { LegalPage, Todo } from "@/components/site/Legal";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cookies et mesure d'audience" };

export default async function CookiesPage() {
  const { analytics: a, retention } = await getSettings();
  return (
    <LegalPage title="Cookies et mesure d'audience" page="cookies">
      <h2>Cookies strictement nécessaires (espace client)</h2>
      <ul>
        <li>Session d&apos;authentification : maintien de la connexion, sécurité.</li>
        <li><code>active_org</code> : mémorise l&apos;organisation active ; l&apos;appartenance est revérifiée à chaque requête.</li>
      </ul>
      <p>Ces cookies ne sont déposés que pour les utilisateurs connectés et sont nécessaires au service demandé.</p>
      <h2>Pages publiques des cartes</h2>
      {a.mode === "off" && <p>Aucune mesure d&apos;audience n&apos;est réalisée sur les cartes.</p>}
      {a.mode !== "off" && (
        <>
          <p>Aucun cookie n&apos;est déposé pour la mesure d&apos;audience. Chaque affichage reçoit un identifiant aléatoire temporaire, conservé uniquement dans la page ouverte, qui permet de rattacher un clic à l&apos;affichage correspondant. L&apos;adresse IP n&apos;est pas conservée. Les données servent uniquement à fournir des statistiques à l&apos;entreprise qui publie la carte, sans suivi entre sites, profilage ni publicité. Données détaillées conservées {retention.analyticsRawDays} jours.</p>
          {a.mode === "consent" ? (
            <p>Cette mesure n&apos;a lieu qu&apos;après votre accord, demandé par un bandeau où accepter et refuser sont proposés au même niveau. Votre choix est mémorisé dans votre navigateur ; pour le modifier, effacez les données du site.</p>
          ) : (
            <p>Cette mesure est réalisée sans demande de consentement, dans le cadre de l&apos;exemption prévue pour la mesure d&apos;audience strictement nécessaire.{!a.validated && <> <Todo>régime à valider juridiquement</Todo></>}</p>
          )}
        </>
      )}
      {a.validated && a.validatedAt && <p className="text-sm text-muted">Régime validé le {formatDate(a.validatedAt)}.</p>}
      <h2>Contenus tiers</h2>
      <p>Les vidéos YouTube (domaine youtube-nocookie.com) ou Vimeo ne sont chargées qu&apos;après un clic explicite sur « Lire la vidéo ». Les liens de réservation, de cartographie et de réseaux sociaux ouvrent des services tiers soumis à leurs propres règles.</p>
    </LegalPage>
  );
}
