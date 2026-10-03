import type { Metadata } from "next";
import { getSettings } from "@/lib/settings/store";
import { LegalPage, Todo, Val } from "@/components/site/Legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Politique de confidentialité" };

const days = (n: number | null, todo: string) => (n === null ? <Todo>{todo}</Todo> : <>{n} jours</>);

export default async function Privacy() {
  const { company: c, retention: r } = await getSettings();
  return (
    <LegalPage title="Politique de confidentialité" page="confidentialite">
      <h2>Responsable de traitement</h2>
      <p><Val v={c.companyName} todo="raison sociale" />, <Val v={c.address} todo="adresse" />. Contact : <Val v={c.contactEmail} todo="email de contact" />.{c.dpo ? <> Délégué à la protection des données : {c.dpo}.</> : null}</p>

      <h2>Données des clients du service</h2>
      <ul>
        <li><strong>Compte</strong> : nom, email, mot de passe (stocké sous forme hachée), journal de connexion. Finalité : fournir l&apos;accès au service. Base légale : <Todo>à valider – exécution du contrat</Todo>.</li>
        <li><strong>Facturation</strong> : organisation, références d&apos;abonnement et de factures. Les données de carte bancaire sont traitées exclusivement par notre prestataire de paiement (Stripe) et ne sont jamais stockées par le service.</li>
        <li><strong>Assistance</strong> : messages et pièces jointes. Les interventions dans votre espace se font via un accès temporaire, notifié et journalisé.</li>
        <li><strong>Emails transactionnels</strong> : confirmation, rappels d&apos;échéance, paiement, sécurité. Aucune campagne marketing n&apos;est envoyée sans accord spécifique.</li>
      </ul>

      <h2 id="visiteurs">Visiteurs des cartes de visite</h2>
      <p>Les cartes sont publiées par nos clients. Pour les données transmises via le formulaire d&apos;une carte, le responsable de traitement est l&apos;entreprise qui publie la carte ; nous agissons comme sous-traitant pour son compte.</p>
      <ul>
        <li><strong>Formulaire de contact</strong> : informations transmises uniquement à l&apos;entreprise destinataire pour répondre à la demande. L&apos;accord pour recevoir des informations commerciales est distinct, facultatif et décoché par défaut.</li>
        <li><strong>Mesure d&apos;audience</strong> : voir la page « Cookies et mesure d&apos;audience ».</li>
        <li><strong>Vidéos</strong> : une vidéo YouTube ou Vimeo n&apos;est chargée que si vous cliquez pour la lire ; ce service tiers applique alors sa propre politique.</li>
      </ul>

      <h2>Durées de conservation</h2>
      <ul>
        <li>Compte et contenus après la fin de l&apos;essai ou de l&apos;abonnement : {days(r.contentAfterEndDays, "durée à définir")}{r.deletedOrgPurgeDays !== null && <>, puis effacement définitif {r.deletedOrgPurgeDays} jours après la suppression</>}.</li>
        <li>Demandes de prospects : {days(r.leadsDays, "durée à définir")}, supprimables à tout moment par l&apos;entreprise destinataire.</li>
        <li>Statistiques détaillées : {r.analyticsRawDays} jours, puis compteurs journaliers anonymes.</li>
        <li>Journal d&apos;audit : {days(r.auditDays, "durée à définir")}.</li>
        <li>Pièces comptables : {r.accountingYears ? `${r.accountingYears} ans` : <Todo>durée légale à confirmer</Todo>}.</li>
      </ul>

      <h2>Destinataires et sous-traitants</h2>
      <p>Hébergement : <Val v={c.host} todo="prestataire et localisation" />. Paiement : Stripe <Todo>vérifier l&apos;entité contractante et les garanties de transfert</Todo>. Emails et stockage des fichiers : <Todo>prestataires et localisation</Todo>.</p>

      <h2>Vos droits</h2>
      <p>Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité, à exercer auprès de <Val v={c.contactEmail} todo="email de contact" />. Les propriétaires d&apos;organisation peuvent exporter leurs données depuis les paramètres. Vous pouvez introduire une réclamation auprès de la CNIL.</p>
    </LegalPage>
  );
}
