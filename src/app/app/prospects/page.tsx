import { DownloadLink } from "@/components/ui/DownloadLink";
import { requireOrgPage } from "@/lib/context";
import { listLeads } from "@/lib/leads/service";
import { sourceLabel } from "@/lib/leads/crm";
import { formatDateTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { Board, type BoardLead } from "./Board";

export default async function LeadsPage() {
  const ctx = await requireOrgPage();
  const rows = await listLeads(ctx, { limit: 1000 });
  const leads: BoardLead[] = rows.map(({ lead, cardTitle, assigneeName }) => ({
    id: lead.id,
    name: lead.name ?? "",
    company: lead.company,
    stage: lead.stage,
    source: lead.source,
    sourceLabel: sourceLabel(lead.source, lead.sourceDetail),
    tags: lead.tags ?? [],
    assigneeName: assigneeName ?? null,
    cardTitle: cardTitle ?? "Carte supprimée",
    createdAt: formatDateTime(lead.createdAt),
  }));
  return (
    <>
      <PageHeader
        title="Prospects"
        description="Votre pipeline commercial. Glissez une fiche d'une colonne à l'autre pour faire avancer la demande. Visible selon vos droits."
        actions={<DownloadLink href="/app/prospects/export" className="text-sm font-semibold text-brand underline">Exporter en CSV</DownloadLink>}
      />
      {leads.length === 0 ? (
        <EmptyState title="Aucune demande">Ajoutez un bloc « Formulaire de contact » à une carte pour recevoir des demandes.</EmptyState>
      ) : (
        <Board initialLeads={leads} />
      )}
    </>
  );
}
