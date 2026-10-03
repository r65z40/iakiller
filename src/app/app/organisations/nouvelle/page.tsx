import { requireUser } from "@/lib/context";
import { hasUsedTrial } from "@/lib/orgs/service";
import { appUrl } from "@/lib/config";
import { Alert, Field, Input, PageHeader, Panel } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { createOrganizationAction } from "../../_actions/org";

export default async function NewOrganizationPage() {
  const user = await requireUser("/app/organisations/nouvelle");
  const host = appUrl().replace(/^https?:\/\//, "");
  const trialUsed = await hasUsedTrial(user.id);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Créer votre organisation" description="L'organisation regroupe vos cartes, vos collaborateurs et votre abonnement." />
      {!user.emailVerified && <div className="mb-4"><Alert tone="warning">Confirmez d&apos;abord votre adresse email.</Alert></div>}
      <Panel>
        <ActionForm action={createOrganizationAction} className="space-y-4">
                        <Field label="Nom de l'entreprise" htmlFor="name">
                <Input id="name" name="name" required minLength={2} maxLength={80} placeholder="Ex. Menuiserie Durand" />
              </Field>
              <Field label="Adresse publique (facultatif)" htmlFor="slug" hint={<>Vos cartes seront accessibles sur {host}/<strong>adresse</strong>/prenom-nom. Laissé vide, elle est déduite du nom.</>}>
                <Input id="slug" name="slug" pattern="[a-z0-9-]{2,48}" placeholder="menuiserie-durand" />
              </Field>
              {trialUsed ? (
                <p className="text-sm text-muted">Vous avez déjà bénéficié de l&apos;essai gratuit : cette nouvelle organisation démarrera sans essai. Vous pourrez préparer vos cartes, puis choisir une formule pour les publier.</p>
              ) : (
                <p className="text-sm text-muted">L&apos;essai gratuit de 7 jours démarre maintenant, sans carte bancaire : jusqu&apos;à 3 cartes. À la fin de l&apos;essai, rien n&apos;est facturé automatiquement. L&apos;essai est accordé une seule fois par compte.</p>
              )}
              <SubmitButton disabled={!user.emailVerified} pendingLabel="Création…">{trialUsed ? "Créer l\u2019organisation" : "Créer et démarrer l\u2019essai"}</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
