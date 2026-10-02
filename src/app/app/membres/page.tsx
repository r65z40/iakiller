import { requireOrgPage } from "@/lib/context";
import { listMembers, listPendingInvitations } from "@/lib/orgs/members";
import { can, ROLE_LABELS, type OrgRole } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { inviteAction } from "../_actions/members";
import { InvitationRow, MemberRow } from "./MembersClient";

export default async function MembersPage() {
  const ctx = await requireOrgPage("members.view");
  const [members, invitations] = await Promise.all([listMembers(ctx), listPendingInvitations(ctx)]);
  const manage = can(ctx, "members.manage");
  return (
    <div className="max-w-4xl">
      <PageHeader title="Membres" description={`${members.length} membre(s) · ${invitations.length} invitation(s) en attente · limite de la formule : ${ctx.entitlement.quotas.members}.`} />
      {manage && (
        <Panel title="Inviter un collaborateur" className="mb-6">
          <ActionForm action={inviteAction} className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
            <Field label="Adresse email" htmlFor="invite-email"><Input id="invite-email" name="email" type="email" required /></Field>
            <Field label="Rôle" htmlFor="invite-role">
              <Select id="invite-role" name="role" defaultValue="member">
                <option value="member">{ROLE_LABELS.member}</option>
                <option value="manager">{ROLE_LABELS.manager}</option>
              </Select>
            </Field>
            <SubmitButton pendingLabel="Envoi…">Inviter</SubmitButton>
          </ActionForm>
          <p className="mt-3 text-xs text-muted">Collaborateur : modifie uniquement les cartes qui lui sont attribuées. Gestionnaire : gère cartes et collaborateurs, sans accès à la facturation (sauf délégation par le propriétaire).</p>
        </Panel>
      )}
      <Panel title="Membres actuels">
        <ul className="divide-y divide-line">
          {members.map(({ membership, user }) => (
            <MemberRow key={membership.id} id={membership.id} name={user.name} email={user.email} role={membership.role as OrgRole} billing={membership.canManageBilling} isSelf={user.id === ctx.user.id} actorRole={ctx.role} canManage={manage} />
          ))}
        </ul>
      </Panel>
      {invitations.length > 0 && (
        <Panel title="Invitations en attente" className="mt-6">
          <ul className="divide-y divide-line">
            {invitations.map((i) => (
              <InvitationRow key={i.id} id={i.id} email={i.email} role={ROLE_LABELS[i.role as OrgRole]} expires={formatDateTime(i.expiresAt)} canManage={manage} />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
