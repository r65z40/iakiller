import type { Metadata } from "next";
import { getSettings } from "@/lib/settings/store";
import { LegalPage, Todo } from "@/components/site/Legal";
import { RichText } from "@/components/card/RichText";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conditions du service" };

export default async function Terms() {
  const s = await getSettings();
  return (
    <LegalPage title="Conditions générales du service" page="conditions">
      <h2>Objet</h2>
      <p>{s.brand.name} permet aux professionnels de créer, publier et partager des cartes de visite numériques. Le service ne comprend ni carte physique, ni puce NFC, ni expédition.</p>
      <h2>Compte et organisation</h2>
      <p>L&apos;inscription requiert une adresse email valide et confirmée. Les cartes, médias, membres, abonnements, prospects et statistiques appartiennent à l&apos;organisation.</p>
      <h2>Essai gratuit</h2>
      <p>Un essai de 7 jours (7 × 24 heures) démarre à la création de l&apos;organisation, sans moyen de paiement, et permet jusqu&apos;à 3 cartes non archivées. À son terme, sans abonnement, les cartes deviennent inaccessibles au public ; aucun paiement n&apos;est déclenché.</p>
      <h2>Abonnements</h2>
      <p>Formules mensuelles ou annuelles, payables d&apos;avance, aux tarifs affichés sur la page Tarifs au jour de la souscription. {s.billing.taxNote || <Todo>présentation HT/TTC et TVA à préciser</Todo>}. Changement de formule : prorata appliqué et affiché avant confirmation.</p>
      <h2>Résiliation</h2>
      <p>La résiliation prend effet à la fin de la période payée ; les cartes restent accessibles jusque-là, puis deviennent indisponibles. Il n&apos;y a pas de maintien gratuit. Le compte reste accessible pour consulter les factures et se réabonner. Conservation des contenus après la fin de droit : {s.retention.contentAfterEndDays !== null ? `${s.retention.contentAfterEndDays} jours` : <Todo>durée à définir</Todo>}.</p>
      <h2>Impayés</h2>
      <p>{s.billing.graceDays > 0 ? <>En cas d&apos;échec de paiement, un délai de grâce de {s.billing.graceDays} jour(s) est accordé, après quoi les cartes sont suspendues jusqu&apos;à régularisation.</> : <>En cas d&apos;échec de paiement, les cartes sont suspendues jusqu&apos;à régularisation.</>}</p>
      <h2>Création accompagnée</h2>
      <p>Prestation ponctuelle facturée séparément, n&apos;incluant pas l&apos;abonnement. La publication de la carte réalisée nécessite la validation du client.</p>
      {s.service.published ? (
        <>
          {s.service.deliveryDelay && <p>Délai : {s.service.deliveryDelay}</p>}
          {s.service.revisionsPolicy && <p>Corrections : {s.service.revisionsPolicy}</p>}
          {s.service.refundPolicy && <p>Remboursement : {s.service.refundPolicy}</p>}
          {s.service.conditions && <RichText text={s.service.conditions} />}
        </>
      ) : (
        <p>Délais, corrections et conditions de remboursement : <Todo>à définir</Todo>.</p>
      )}
      <h2>Contenus</h2>
      <p>Le client est responsable des contenus publiés et garantit disposer des droits sur les textes et images. L&apos;éditeur peut suspendre une carte manifestement illicite, avec motif.</p>
      <h2>Disponibilité, responsabilité, droit applicable</h2>
      <p><Todo>Engagements de disponibilité, limitation de responsabilité, médiation de la consommation le cas échéant, juridiction compétente</Todo>.</p>
    </LegalPage>
  );
}
