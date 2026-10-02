import type { Metadata } from "next";
import { brand } from "@/lib/config";
import { LegalPage, Todo } from "@/components/site/Legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function Privacy() {
  const l = brand.legal;
  return (
    <LegalPage title="Politique de confidentialité">
      <h2>Responsable de traitement</h2>
      <p>{l.companyName}, {l.address}. Contact : {l.contactEmail}. Délégué à la protection des données : <Todo>à désigner si applicable</Todo>.</p>

      <h2>Données des clients du service</h2>
      <ul>
        <li><strong>Compte</strong> : nom, email, mot de passe (stocké sous forme hachée), journal de connexion. Finalité : fournir l&apos;accès au service. Base légale : <Todo>à valider – exécution du contrat</Todo>.</li>
        <li><strong>Facturation</strong> : organisation, références d&apos;abonnement et de factures. Les données de carte bancaire sont traitées exclusivement par notre prestataire de paiement (Stripe) et ne sont jamais stockées par le service. Base légale : <Todo>à valider</Todo>.</li>
        <li><strong>Assistance</strong> : messages et pièces jointes. Les interventions dans votre espace se font via un accès temporaire, notifié et journalisé.</li>
        <li><strong>Emails transactionnels</strong> : confirmation, rappels d&apos;échéance, paiement, sécurité. Aucune campagne marketing n&apos;est envoyée sans accord spécifique.</li>
      </ul>

      <h2 id="visiteurs">Visiteurs des cartes de visite</h2>
      <p>Les cartes sont publiées par nos clients. Pour les données transmises via le formulaire d&apos;une carte (nom, email, téléphone, société, message), le responsable de traitement est l&apos;entreprise qui publie la carte ; nous agissons comme sous-traitant pour son compte.</p>
      <ul>
        <li><strong>Formulaire de contact</strong> : les informations sont transmises uniquement à l&apos;entreprise destinataire pour répondre à la demande. L&apos;accord pour recevoir des informations commerciales est distinct, facultatif et décoché par défaut.</li>
        <li><strong>Mesure d&apos;audience</strong> : ouvertures de carte et clics (type d&apos;action, source, catégorie d&apos;appareil et de navigateur, pays s&apos;il est fourni par l&apos;hébergeur). Aucun cookie ni identifiant persistant n&apos;est déposé à cette fin, l&apos;adresse IP n&apos;est pas conservée dans les statistiques. Détails sur la page « Cookies et mesure d&apos;audience ».</li>
        <li><strong>Vidéos</strong> : une vidéo YouTube ou Vimeo n&apos;est chargée que si vous cliquez pour la lire ; ce service tiers applique alors sa propre politique.</li>
      </ul>

      <h2>Durées de conservation</h2>
      <ul>
        <li>Compte et contenus : <Todo>durée à définir après la fin de l&apos;abonnement</Todo>. Aucune suppression automatique n&apos;a lieu à la fin d&apos;un essai ou d&apos;un abonnement tant que cette durée n&apos;est pas fixée.</li>
        <li>Demandes de prospects : <Todo>durée à définir</Todo>, supprimables à tout moment par l&apos;entreprise destinataire.</li>
        <li>Statistiques détaillées : {process.env.ANALYTICS_RAW_RETENTION_DAYS ?? "395"} jours, puis agrégats journaliers anonymes <Todo>durée à valider</Todo>.</li>
        <li>Journaux techniques et d&apos;audit : <Todo>durée à définir</Todo>.</li>
        <li>Pièces comptables : <Todo>durée légale à confirmer avec votre expert-comptable</Todo>.</li>
      </ul>

      <h2>Destinataires et sous-traitants</h2>
      <p>Hébergement : <Todo>prestataire et localisation</Todo>. Stockage des fichiers : <Todo>prestataire et localisation</Todo>. Paiement : Stripe <Todo>vérifier l&apos;entité contractante et les garanties de transfert</Todo>. Emails : <Todo>prestataire</Todo>.</p>

      <h2>Vos droits</h2>
      <p>Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité, à exercer auprès de {l.contactEmail}. Les propriétaires d&apos;organisation peuvent exporter leurs données depuis les paramètres. Vous pouvez introduire une réclamation auprès de la CNIL.</p>
    </LegalPage>
  );
}
