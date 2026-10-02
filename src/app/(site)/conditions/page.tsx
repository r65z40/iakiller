import type { Metadata } from "next";
import { brand } from "@/lib/config";
import { LegalPage, Todo } from "@/components/site/Legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conditions du service" };

export default function Terms() {
  return (
    <LegalPage title="Conditions générales du service">
      <h2>Objet</h2>
      <p>{brand.name} permet aux professionnels de créer, publier et partager des cartes de visite numériques. Le service ne comprend ni carte physique, ni puce NFC, ni expédition.</p>
      <h2>Compte et organisation</h2>
      <p>L&apos;inscription requiert une adresse email valide et confirmée. Les cartes, médias, membres, abonnements, prospects et statistiques appartiennent à l&apos;organisation.</p>
      <h2>Essai gratuit</h2>
      <p>Un essai de 7 jours (7 × 24 heures) démarre à la création de l&apos;organisation, sans moyen de paiement, et permet jusqu&apos;à 3 cartes non archivées. À son terme, sans abonnement, les cartes deviennent inaccessibles au public ; aucun paiement n&apos;est déclenché.</p>
      <h2>Abonnements</h2>
      <p>Formules mensuelles ou annuelles, payables d&apos;avance. Tarifs : <Todo>à publier</Todo>. Présentation HT/TTC et TVA : <Todo>selon la situation fiscale de l&apos;éditeur</Todo>. Changement de formule : prorata appliqué et affiché avant confirmation.</p>
      <h2>Résiliation</h2>
      <p>La résiliation prend effet à la fin de la période payée ; les cartes restent accessibles jusque-là, puis deviennent indisponibles. Il n&apos;y a pas de maintien gratuit. Le compte reste accessible pour consulter les factures et se réabonner. Conservation des contenus après résiliation : <Todo>durée à définir</Todo>.</p>
      <h2>Impayés</h2>
      <p>En cas d&apos;échec de paiement, un délai de grâce de <Todo>{process.env.BILLING_GRACE_DAYS ?? "7"} jours, à valider</Todo> est accordé, après quoi les cartes sont suspendues jusqu&apos;à régularisation.</p>
      <h2>Création accompagnée</h2>
      <p>Prestation ponctuelle facturée séparément, n&apos;incluant pas l&apos;abonnement. Nombre de corrections, délais et conditions de remboursement : <Todo>à définir</Todo>. La publication de la carte réalisée nécessite la validation du client.</p>
      <h2>Contenus</h2>
      <p>Le client est responsable des contenus publiés et garantit disposer des droits sur les textes et images. L&apos;éditeur peut suspendre une carte manifestement illicite, avec motif.</p>
      <h2>Disponibilité, responsabilité, droit applicable</h2>
      <p><Todo>Engagements de disponibilité, limitation de responsabilité, médiation de la consommation le cas échéant, juridiction compétente</Todo>.</p>
    </LegalPage>
  );
}
