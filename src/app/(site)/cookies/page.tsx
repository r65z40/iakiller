import type { Metadata } from "next";
import { LegalPage, Todo } from "@/components/site/Legal";
import { analyticsConfig } from "@/lib/analytics/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cookies et mesure d'audience" };

export default function CookiesPage() {
  const cfg = analyticsConfig();
  return (
    <LegalPage title="Cookies et mesure d'audience">
      <h2>Cookies strictement nécessaires (espace client)</h2>
      <ul>
        <li>Session d&apos;authentification (Better Auth) : maintien de la connexion, sécurité.</li>
        <li><code>active_org</code> : mémorise l&apos;organisation active ; l&apos;appartenance est revérifiée à chaque requête.</li>
      </ul>
      <p>Ces cookies ne sont déposés que pour les utilisateurs connectés et sont nécessaires au service demandé.</p>
      <h2>Pages publiques des cartes</h2>
      <p>Aucun cookie n&apos;est déposé pour la mesure d&apos;audience. Chaque affichage reçoit un identifiant aléatoire temporaire, conservé uniquement dans la page ouverte, qui permet de rattacher un clic à l&apos;affichage correspondant. Aucune donnée ne sert au suivi entre sites, au profilage ni à la publicité.</p>
      <p>Mode actuel : {cfg.enabled ? (cfg.requireConsent ? "mesure soumise à votre accord préalable ; votre choix est mémorisé dans votre navigateur et peut être modifié en vidant les données du site." : "mesure d'audience limitée, sans dépôt de traceur.") : "mesure désactivée."}</p>
      <p>L&apos;absence de cookie ne suffit pas, à elle seule, à établir une dispense de consentement : le régime retenu doit être validé au regard des recommandations de la CNIL relatives aux outils de mesure d&apos;audience <Todo>validation juridique à réaliser</Todo>. Le service permet d&apos;exiger le consentement préalable (paramètre ANALYTICS_REQUIRE_CONSENT).</p>
      <h2>Contenus tiers</h2>
      <p>Les vidéos YouTube (domaine youtube-nocookie.com) ou Vimeo ne sont chargées qu&apos;après un clic explicite sur « Lire la vidéo ». Les liens de réservation, de cartographie et de réseaux sociaux ouvrent des services tiers soumis à leurs propres règles.</p>
    </LegalPage>
  );
}
