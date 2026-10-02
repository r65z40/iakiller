import type { Metadata } from "next";
import { brand } from "@/lib/config";
import { LegalPage } from "@/components/site/Legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalNotice() {
  const l = brand.legal;
  return (
    <LegalPage title="Mentions légales">
      <h2>Éditeur du service</h2>
      <ul>
        <li>Raison sociale : {l.companyName}</li>
        <li>Forme juridique et capital : {l.legalForm} – {l.capital}</li>
        <li>Siège social : {l.address}</li>
        <li>Immatriculation : {l.siren}</li>
        <li>TVA intracommunautaire : {l.vat}</li>
        <li>Directeur ou directrice de la publication : {l.director}</li>
        <li>Contact : {l.contactEmail}</li>
      </ul>
      <h2>Hébergement</h2>
      <p>{l.host}</p>
      <h2>Contenus des cartes</h2>
      <p>Les cartes de visite publiées sont rédigées par les clients du service, qui en sont responsables. Pour signaler un contenu illicite, écrivez à {l.contactEmail} en précisant l&apos;adresse de la carte concernée.</p>
    </LegalPage>
  );
}
