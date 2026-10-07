import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgPage } from "@/lib/context";
import { getLeadForActor, listLeadActivity, listLeadTasks, listAssignableMembers } from "@/lib/leads/service";
import { sourceLabel } from "@/lib/leads/crm";
import { can } from "@/lib/permissions";
import { DomainError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { LeadDetail } from "./LeadDetail";

export default async function LeadPage({ params }: PageProps<"/app/prospects/[id]">) {
  const ctx = await requireOrgPage();
  const { id } = await params;
  let row, activity, tasks, members;
  try {
    [row, activity, tasks, members] = await Promise.all([
      getLeadForActor(ctx, id),
      listLeadActivity(ctx, id),
      listLeadTasks(ctx, id),
      listAssignableMembers(ctx),
    ]);
  } catch (err) {
    if (err instanceof DomainError && err.code === "not_found") notFound();
    throw err;
  }
  const { lead, cardTitle, assigneeName } = row;
  const canManage = can(ctx, "leads.viewAll");

  return (
    <>
      <PageHeader
        title={lead.name || "Prospect sans nom"}
        description={`Reçu le ${formatDateTime(lead.createdAt)} · via « ${cardTitle ?? "Carte supprimée"} » · ${sourceLabel(lead.source, lead.sourceDetail)}`}
        actions={<Link href="/app/prospects" className="text-sm font-semibold text-brand underline">← Pipeline</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="rounded-xl bg-white p-4 ring-1 ring-line">
            <h2 className="text-sm font-bold">Coordonnées</h2>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {lead.company && (<><dt className="font-semibold text-muted">Société</dt><dd>{lead.company}</dd></>)}
              {lead.email && (<><dt className="font-semibold text-muted">Email</dt><dd><a href={`mailto:${lead.email}`} className="text-brand underline">{lead.email}</a></dd></>)}
              {lead.phone && (<><dt className="font-semibold text-muted">Téléphone</dt><dd><a href={`tel:${lead.phone}`} className="text-brand underline">{lead.phone}</a></dd></>)}
              <dt className="font-semibold text-muted">Marketing</dt><dd>{lead.marketingConsent ? "Accord donné" : "Pas d'accord"}</dd>
            </dl>
          </section>

          {lead.message && (
            <section className="rounded-xl bg-white p-4 ring-1 ring-line">
              <h2 className="text-sm font-bold">Demande</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm">{lead.message}</p>
            </section>
          )}

          {(lead.extra ?? []).length > 0 && (
            <section className="rounded-xl bg-white p-4 ring-1 ring-line">
              <h2 className="text-sm font-bold">Champs sur mesure</h2>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {(lead.extra ?? []).map((e, i) => (
                  <div key={i} className="contents">
                    <dt className="font-semibold text-muted">{e.label}</dt>
                    <dd className="whitespace-pre-wrap">{e.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {(lead.photoIds ?? []).length > 0 && (
            <section className="rounded-xl bg-white p-4 ring-1 ring-line">
              <h2 className="text-sm font-bold">Photos jointes</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {(lead.photoIds ?? []).map((pid) => (
                  <a key={pid} href={`/api/media/${pid}`} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/media/${pid}`} alt="Photo jointe" className="h-24 w-24 rounded-lg object-cover ring-1 ring-line" />
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl bg-white p-4 ring-1 ring-line">
            <h2 className="text-sm font-bold">Historique</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {activity.map(({ activity: a, actorName }) => (
                <li key={a.id} className="flex gap-3">
                  <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <div>
                    <p>{a.text}</p>
                    <p className="text-xs text-muted">{formatDateTime(a.createdAt)}{actorName ? ` · ${actorName}` : ""}</p>
                  </div>
                </li>
              ))}
              {activity.length === 0 && <li className="text-muted">Aucun évènement.</li>}
            </ol>
          </section>
        </div>

        <LeadDetail
          leadId={lead.id}
          canManage={canManage}
          stage={lead.stage}
          notes={lead.notes ?? ""}
          tags={lead.tags ?? []}
          assignedToId={lead.assignedToId}
          assigneeName={assigneeName ?? null}
          members={members}
          tasks={tasks.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt ? t.dueAt.toISOString() : null, done: !!t.doneAt }))}
        />
      </div>
    </>
  );
}
