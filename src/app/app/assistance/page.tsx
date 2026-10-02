import Link from "next/link";
import { requireOrgPage } from "@/lib/context";
import { listActiveGrants, listTickets } from "@/lib/support/service";
import { listMedia } from "@/lib/media/service";
import { can } from "@/lib/permissions";
import { brand } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { Badge, Field, Input, PageHeader, Panel, Select, Textarea } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { createTicketAction } from "../_actions/support";
import { RevokeGrant } from "./RevokeGrant";

const STATUS: Record<string, string> = { open: "Ouverte", pending: "Réponse reçue", closed: "Clôturée" };

export default async function SupportPage() {
  const ctx = await requireOrgPage();
  const [tickets, grants, media] = await Promise.all([listTickets(ctx), can(ctx, "members.manage") ? listActiveGrants(ctx.organization.id) : Promise.resolve([]), listMedia(ctx)]);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Assistance" description={`Écrivez-nous ici ou à ${brand.supportEmail}. L'équipe ne vous demandera jamais votre mot de passe.`} />
      {grants.length > 0 && (
        <Panel title="Accès d'assistance en cours" description="Un membre de l'équipe peut intervenir dans votre organisation. Toutes ses actions sont journalisées.">
          <ul className="divide-y divide-line">
            {grants.map(({ grant, staffName }) => (
              <li key={grant.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><strong>{staffName}</strong> · {grant.reason} · jusqu&apos;au {formatDateTime(grant.expiresAt)}</span>
                <RevokeGrant id={grant.id} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel title="Nouvelle demande">
        <ActionForm action={createTicketAction} className="space-y-4">
          <Field label="Objet" htmlFor="subject"><Input id="subject" name="subject" required minLength={3} maxLength={150} /></Field>
          <Field label="Message" htmlFor="body"><Textarea id="body" name="body" rows={5} required minLength={5} maxLength={5000} /></Field>
          {media.length > 0 && (
            <Field label="Pièce jointe (facultatif, depuis vos médias)" htmlFor="mediaId">
              <Select id="mediaId" name="mediaId" defaultValue=""><option value="">Aucune</option>{media.map((m) => <option key={m.id} value={m.id}>{m.originalName}</option>)}</Select>
            </Field>
          )}
          <SubmitButton pendingLabel="Envoi…">Envoyer</SubmitButton>
        </ActionForm>
      </Panel>
      <Panel title="Vos demandes">
        {tickets.length === 0 ? <p className="text-sm text-muted">Aucune demande.</p> : (
          <ul className="divide-y divide-line">
            {tickets.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/app/assistance/${t.id}`} className="font-semibold hover:underline">{t.subject}</Link>
                <span className="flex items-center gap-2 text-muted">{formatDateTime(t.updatedAt)} <Badge tone={t.status === "pending" ? "brand" : "neutral"}>{STATUS[t.status]}</Badge></span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
