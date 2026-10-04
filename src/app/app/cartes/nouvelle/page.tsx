import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgPage } from "@/lib/context";
import { listCardsForActor } from "@/lib/cards/service";
import { TEMPLATE_PRESETS, emptyDocument } from "@/lib/cards/defaults";
import type { TemplateId } from "@/lib/cards/document";
import { Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { CardThumbnail } from "@/components/card/CardThumbnail";
import { createCardAction } from "../../_actions/cards";

export const metadata: Metadata = { title: "Créer une carte" };

/** Modèle d'exemple pour les miniatures d'explication. */
function sample(template: TemplateId) {
  const doc = emptyDocument(template);
  doc.identity.firstName = "Camille";
  doc.identity.lastName = "Moreau";
  doc.identity.jobTitle = "Menuisière";
  doc.identity.company = "Atelier Moreau";
  return doc;
}

export default async function NewCardPage() {
  const ctx = await requireOrgPage("cards.create");
  const quota = ctx.entitlement.quotas.cards;
  const used = (await listCardsForActor(ctx)).length;
  if (used >= quota) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Créer une carte" />
        <Panel><p className="text-sm text-muted">Limite de {quota} carte(s) atteinte. Archivez une carte existante ou passez à une formule supérieure. <Link href="/app/cartes" className="text-brand underline">Retour aux cartes</Link></p></Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Créer une carte" description="Choisissez la méthode qui vous convient. Vous pourrez tout modifier ensuite." actions={<Link href="/app/cartes" className="text-sm font-semibold text-brand underline">← Mes cartes</Link>} />

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col rounded-2xl bg-white p-6 ring-1 ring-brand/30">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">Recommandé</span>
          <h2 className="mt-3 text-xl font-bold">Création guidée</h2>
          <p className="mt-1 flex-1 text-sm text-muted">Répondez à quelques questions simples (nom, métier, coordonnées, style). Nous préparons votre carte, vous la finalisez. Idéal pour démarrer en 2 minutes.</p>
          <Link href="/app/cartes/nouvelle/guide" className="mt-4 rounded-lg bg-brand px-5 py-3 text-center font-semibold text-white hover:bg-brand-dark">Commencer la création guidée</Link>
        </div>

        <div className="flex flex-col rounded-2xl bg-white p-6 ring-1 ring-line">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-muted">Avancé</span>
          <h2 className="mt-3 text-xl font-bold">Éditeur complet</h2>
          <p className="mt-1 text-sm text-muted">Partez d&apos;une carte vierge et composez librement avec tous les blocs. Pour les utilisateurs à l&apos;aise.</p>
          <ActionForm action={createCardAction} className="mt-4 space-y-3">
            <Field label="Nom interne de la carte" htmlFor="title"><Input id="title" name="title" required maxLength={80} placeholder="Ex. Camille Martin – Commerciale" /></Field>
            <Field label="Modèle de départ" htmlFor="template"><Select id="template" name="template" defaultValue="classique">{Object.entries(TEMPLATE_PRESETS).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}</Select></Field>
            <SubmitButton variant="secondary" pendingLabel="Ouverture…">Ouvrir l&apos;éditeur</SubmitButton>
          </ActionForm>
        </div>
      </div>

      <h2 className="mt-10 text-lg font-bold">Les trois modèles</h2>
      <p className="mt-1 text-sm text-muted">Un modèle change la <strong>présentation</strong>, jamais vos informations : vous passez de l&apos;un à l&apos;autre à tout moment.</p>
      <ul className="mt-5 grid gap-5 sm:grid-cols-3">
        {(Object.keys(TEMPLATE_PRESETS) as TemplateId[]).map((id) => (
          <li key={id} className="rounded-2xl bg-white p-5 ring-1 ring-line">
            <div className="flex justify-center"><CardThumbnail doc={sample(id)} /></div>
            <h3 className="mt-3 font-bold">{TEMPLATE_PRESETS[id].label}</h3>
            <p className="mt-1 text-sm text-muted">{TEMPLATE_PRESETS[id].description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
