import { DownloadLink } from "@/components/ui/DownloadLink";
import { requireOrgPage } from "@/lib/context";
import { listMembers } from "@/lib/orgs/members";
import { can } from "@/lib/permissions";
import { appUrl } from "@/lib/config";
import { Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { deleteOrganizationAction, transferOwnershipAction, updateOrganizationAction } from "../_actions/org";
import { LeaveButton, SecurityPanel } from "./SettingsClient";

export default async function SettingsPage() {
  const ctx = await requireOrgPage();
  const isOwner = can(ctx, "org.update");
  const members = isOwner ? (await listMembers(ctx)).filter((m) => m.user.id !== ctx.user.id) : [];
  const host = appUrl().replace(/^https?:\/\//, "");
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Paramètres" />
      <SecurityPanel twoFactorEnabled={ctx.user.twoFactorEnabled} />
      {isOwner && (
        <Panel title="Organisation">
          <ActionForm action={updateOrganizationAction} className="space-y-4">
            <Field label="Nom" htmlFor="org-name"><Input id="org-name" name="name" defaultValue={ctx.organization.name} required maxLength={80} /></Field>
            <Field label="Adresse publique" htmlFor="org-slug" hint={<>{host}/<strong>adresse</strong>/… — l&apos;ancienne adresse continue de rediriger et reste réservée à votre organisation.</>}>
              <Input id="org-slug" name="slug" defaultValue={ctx.organization.slug} required pattern="[a-z0-9-]{2,48}" />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="allowIndexing" defaultChecked={ctx.organization.allowIndexing} className="mt-0.5 h-4 w-4" />
              <span>Autoriser les moteurs de recherche à indexer les cartes publiées (désactivé par défaut). Aucun annuaire public des cartes n&apos;est proposé.</span>
            </label>
            <SubmitButton>Enregistrer</SubmitButton>
          </ActionForm>
        </Panel>
      )}
      {isOwner && (
        <Panel title="Données de l'organisation" description="Export des contenus, membres et prospects au format JSON (hors fichiers binaires). Les cartes exportées ne sont pas publiables en dehors du service.">
          <DownloadLink href="/app/parametres/export" className="text-sm font-semibold text-brand underline">Télécharger l&apos;export JSON</DownloadLink>
        </Panel>
      )}
      {isOwner && members.length > 0 && (
        <Panel title="Transférer la propriété" description="Le nouveau propriétaire obtient la facturation et la suppression ; vous devenez gestionnaire.">
          <ActionForm action={transferOwnershipAction} className="flex flex-wrap items-end gap-3">
            <Field label="Nouveau propriétaire" htmlFor="new-owner">
              <Select id="new-owner" name="userId" required>{members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name} ({m.user.email})</option>)}</Select>
            </Field>
            <SubmitButton variant="secondary">Transférer</SubmitButton>
          </ActionForm>
        </Panel>
      )}
      {!isOwner && <Panel title="Quitter l'organisation"><LeaveButton /></Panel>}
      {isOwner && (
        <Panel title="Supprimer l'organisation" description="Les cartes deviennent immédiatement indisponibles. Résiliez d'abord l'abonnement. Les pièces comptables sont conservées séparément selon la politique de conservation.">
          <ActionForm action={deleteOrganizationAction} className="flex flex-wrap items-end gap-3">
            <Field label={`Saisissez « ${ctx.organization.slug} » pour confirmer`} htmlFor="confirm"><Input id="confirm" name="confirm" required autoComplete="off" /></Field>
            <SubmitButton variant="danger">Supprimer</SubmitButton>
          </ActionForm>
        </Panel>
      )}
    </div>
  );
}
