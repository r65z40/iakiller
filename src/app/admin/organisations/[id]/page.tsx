import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/context";
import { organizationDetail } from "@/lib/admin/service";
import { listActiveGrants } from "@/lib/support/service";
import { STATE_LABELS } from "@/lib/billing/entitlements";
import { ROLE_LABELS, type OrgRole } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { DomainError } from "@/lib/errors";
import { Badge, Button, PageHeader, Panel } from "@/components/ui";
import { Flash } from "../../_lib/Flash";
import { enterSupportModeAction, grantAccessAction, suspendCardAction, suspendOrgAction, syncBillingAction } from "../../_lib/actions";

export default async function AdminOrgDetail({ params, searchParams }: PageProps<"/admin/organisations/[id]">) {
  const staff = await requireStaffPage();
  const { id } = await params;
  const sp = await searchParams;
  let d;
  try { d = await organizationDetail(staff, id); } catch (e) { if (e instanceof DomainError) notFound(); throw e; }
  const grants = await listActiveGrants(id);
  const mine = grants.find((g) => g.grant.staffUserId === staff.id);
  return (
    <>
      <PageHeader title={d.org.name} description={`/${d.org.slug} · créée le ${formatDateTime(d.org.createdAt)}`} actions={<Badge tone={d.ent.publicAccess ? "success" : "warning"}>{STATE_LABELS[d.ent.state]}</Badge>} />
      <Flash sp={sp} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Membres">
          <ul className="space-y-1 text-sm">{d.members.map((m) => <li key={m.membership.id}>{m.name} · {m.email} · {ROLE_LABELS[m.membership.role as OrgRole]}</li>)}</ul>
        </Panel>
        <Panel title="Abonnements (synchronisés depuis Stripe)">
          {d.subs.length === 0 ? <p className="text-sm text-muted">Aucun.</p> : <ul className="space-y-1 text-sm">{d.subs.map((s) => <li key={s.id}>{s.stripeSubscriptionId} · {s.status}{s.cancelAtPeriodEnd ? " · résiliation programmée" : ""} · échéance {formatDateTime(s.currentPeriodEnd)} · synchro {formatDateTime(s.lastSyncedAt)}</li>)}</ul>}
          <form action={syncBillingAction} className="mt-3"><input type="hidden" name="id" value={id} /><Button size="sm" variant="secondary">Resynchroniser avec Stripe</Button></form>
        </Panel>
        <Panel title="Suspension de l'organisation">
          {d.org.adminSuspendedAt ? (
            <form action={suspendOrgAction} className="space-y-2 text-sm"><p>Suspendue le {formatDateTime(d.org.adminSuspendedAt)} : {d.org.adminSuspendedReason}</p><input type="hidden" name="id" value={id} /><input type="hidden" name="suspend" value="0" /><input type="hidden" name="reason" value="" /><Button size="sm">Rétablir</Button></form>
          ) : (
            <form action={suspendOrgAction} className="space-y-2"><input type="hidden" name="id" value={id} /><input type="hidden" name="suspend" value="1" /><label className="block text-sm font-semibold">Motif (obligatoire, journalisé)<input name="reason" required minLength={5} className="mt-1 block min-h-10 w-full rounded-lg border border-line px-3" /></label><Button size="sm" variant="danger">Suspendre</Button></form>
          )}
        </Panel>
        <Panel title="Accès d'assistance" description="Temporaire (24 h max), motivé, notifié au propriétaire et révocable par lui.">
          {grants.length > 0 && <ul className="mb-3 space-y-1 text-sm">{grants.map((g) => <li key={g.grant.id}>{g.staffName} · {g.grant.reason} · jusqu&apos;au {formatDateTime(g.grant.expiresAt)}</li>)}</ul>}
          {mine ? (
            <form action={enterSupportModeAction}><input type="hidden" name="id" value={id} /><Button size="sm">Entrer dans l&apos;espace client (mode assistance)</Button></form>
          ) : (
            <form action={grantAccessAction} className="space-y-2"><input type="hidden" name="id" value={id} />
              <label className="block text-sm font-semibold">Motif<input name="reason" required minLength={10} className="mt-1 block min-h-10 w-full rounded-lg border border-line px-3" /></label>
              <label className="block text-sm font-semibold">Durée (heures, 24 max)<input name="hours" type="number" min={1} max={24} defaultValue={2} className="mt-1 block min-h-10 w-24 rounded-lg border border-line px-3" /></label>
              <Button size="sm" variant="secondary">Ouvrir un accès</Button>
            </form>
          )}
        </Panel>
      </div>
      <Panel title="Cartes" className="mt-6">
        <ul className="divide-y divide-line text-sm">
          {d.cards.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><strong>{c.title}</strong> · /{d.org.slug}/{c.slug} · {c.status}{c.disabledAt ? " · désactivée" : ""}{c.adminSuspendedAt ? ` · SUSPENDUE (${c.adminSuspendedReason})` : ""}</span>
              <form action={suspendCardAction} className="flex items-center gap-2">
                <input type="hidden" name="cardId" value={c.id} /><input type="hidden" name="orgId" value={id} />
                {c.adminSuspendedAt ? (<><input type="hidden" name="suspend" value="0" /><input type="hidden" name="reason" value="" /><Button size="sm" variant="secondary">Rétablir</Button></>) : (<><input type="hidden" name="suspend" value="1" /><input name="reason" placeholder="Motif" required minLength={5} aria-label={`Motif de suspension de ${c.title}`} className="min-h-9 rounded-lg border border-line px-2" /><Button size="sm" variant="danger">Suspendre</Button></>)}
              </form>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
