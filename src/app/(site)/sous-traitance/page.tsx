import type { Metadata } from "next";
import { LegalPage, Todo } from "@/components/site/Legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Accord de sous-traitance" };

export default async function Dpa() {
  return (
    <LegalPage title="Accord de traitement des données (article 28 RGPD)" page="sousTraitance">
      <p>Pour les données des visiteurs des cartes (formulaires de contact et statistiques), le client agit comme responsable de traitement et l&apos;éditeur comme sous-traitant.</p>
      <h2>Éléments à formaliser</h2>
      <ul>
        <li>Objet, durée, nature et finalité du traitement : hébergement et affichage des cartes, réception des demandes de contact, mesure d&apos;audience.</li>
        <li>Catégories de données : identité et coordonnées saisies par les visiteurs, contenu des messages, événements de navigation sans identifiant persistant.</li>
        <li>Instructions documentées du client, confidentialité des personnes autorisées.</li>
        <li>Mesures de sécurité : contrôle d&apos;accès par organisation et par rôle, chiffrement en transit, journal d&apos;audit, sauvegardes <Todo>chiffrement au repos selon l&apos;hébergeur</Todo>.</li>
        <li>Sous-traitants ultérieurs : <Todo>liste et localisation</Todo>.</li>
        <li>Assistance à l&apos;exercice des droits, notification des violations <Todo>délai</Todo>, suppression ou restitution en fin de contrat <Todo>modalités</Todo>.</li>
      </ul>
    </LegalPage>
  );
}
