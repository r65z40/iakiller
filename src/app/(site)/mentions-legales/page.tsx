import type { Metadata } from "next";
import { getSettings } from "@/lib/settings/store";
import { LegalPage, Val } from "@/components/site/Legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentions légales" };

export default async function LegalNotice() {
  const { company: c, brand } = await getSettings();
  return (
    <LegalPage title="Mentions légales" page="mentions">
      <h2>Éditeur du service</h2>
      <ul>
        <li>Raison sociale : <Val v={c.companyName} todo="raison sociale à compléter" /></li>
        <li>Forme juridique et capital : <Val v={c.legalForm} todo="forme juridique" /> – <Val v={c.capital} todo="capital social" /></li>
        <li>Siège social : <Val v={c.address} todo="adresse du siège" /></li>
        <li>Immatriculation : <Val v={c.siren} todo="SIREN / RCS" /></li>
        <li>TVA intracommunautaire : <Val v={c.vat} todo="numéro de TVA" /></li>
        <li>Directeur ou directrice de la publication : <Val v={c.director} todo="à désigner" /></li>
        <li>Contact : <Val v={c.contactEmail} todo="email de contact" /></li>
      </ul>
      <h2>Hébergement</h2>
      <p><Val v={c.host} todo="hébergeur : nom, adresse, téléphone" /></p>
      <h2>Contenus des cartes</h2>
      <p>Les cartes de visite publiées sur {brand.name} sont rédigées par les clients du service, qui en sont responsables. Pour signaler un contenu illicite, écrivez à <Val v={c.contactEmail} todo="email de contact" /> en précisant l&apos;adresse de la carte concernée.</p>
    </LegalPage>
  );
}
