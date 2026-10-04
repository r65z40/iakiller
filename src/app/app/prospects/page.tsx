import { DownloadLink } from "@/components/ui/DownloadLink";
import { requireOrgPage } from "@/lib/context";
import { listLeads } from "@/lib/leads/service";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { LeadRow } from "./LeadRow";

const STATUS = { "": "Tous", new: "Nouveaux", contacted: "Contactés", done: "Traités" } as const;

export default async function LeadsPage({ searchParams }: PageProps<"/app/prospects">) {
  const ctx = await requireOrgPage();
  const sp = await searchParams;
  const status = typeof sp.statut === "string" ? sp.statut : "";
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const leads = await listLeads(ctx, { status: status || undefined, limit: 50, offset: page * 50 });
  return (
    <>
      <PageHeader title="Prospects" description="Demandes envoyées depuis le formulaire de vos cartes. Visibles uniquement par votre organisation, selon vos droits." actions={<DownloadLink href="/app/prospects/export" className="text-sm font-semibold text-brand underline">Exporter en CSV</DownloadLink>} />
      <nav aria-label="Filtrer par statut" className="mb-4 flex flex-wrap gap-2">
        {Object.entries(STATUS).map(([k, label]) => (
          <a key={k} href={k ? `/app/prospects?statut=${k}` : "/app/prospects"} aria-current={status === k ? "page" : undefined} className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${status === k ? "bg-brand text-white ring-brand" : "bg-white ring-line"}`}>{label}</a>
        ))}
      </nav>
      {leads.length === 0 ? (
        <EmptyState title="Aucune demande">Ajoutez un bloc « Formulaire de contact » à une carte pour recevoir des demandes.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {leads.map(({ lead, cardTitle }) => (
            <LeadRow key={lead.id} canDelete={can(ctx, "leads.viewAll")} lead={{ id: lead.id, name: lead.name, email: lead.email, phone: lead.phone, company: lead.company, message: lead.message, extra: lead.extra ?? [], status: lead.status, notes: lead.notes ?? "", marketingConsent: lead.marketingConsent, createdAt: formatDateTime(lead.createdAt), cardTitle: cardTitle ?? "Carte supprimée" }} />
          ))}
        </ul>
      )}
      <div className="mt-4 flex gap-3 text-sm">
        {page > 0 && <a className="text-brand underline" href={`/app/prospects?statut=${status}&page=${page - 1}`}>← Précédents</a>}
        {leads.length === 50 && <a className="text-brand underline" href={`/app/prospects?statut=${status}&page=${page + 1}`}>Suivants →</a>}
      </div>
    </>
  );
}
