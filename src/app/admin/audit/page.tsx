import { requireStaffPage } from "@/lib/context";
import { auditTrail } from "@/lib/admin/service";
import { formatDateTime } from "@/lib/format";
import { PageHeader, Panel } from "@/components/ui";

export default async function AdminAudit({ searchParams }: PageProps<"/admin/audit">) {
  const staff = await requireStaffPage("platform.audit.view");
  const sp = await searchParams;
  const rows = await auditTrail(staff, { organizationId: typeof sp.org === "string" ? sp.org : undefined, limit: 300 });
  return (
    <>
      <PageHeader title="Journal d'audit" description="Actions critiques des utilisateurs, du personnel (y compris en mode assistance) et de Stripe." />
      <Panel>
        <table className="w-full text-left text-xs">
          <thead className="uppercase text-muted"><tr><th className="py-2">Date</th><th>Acteur</th><th>Action</th><th>Organisation</th><th>Cible</th><th>Détails</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}><td className="py-1.5 whitespace-nowrap">{formatDateTime(r.createdAt)}</td><td>{r.actorType}{r.supportGrantId ? " (assistance)" : ""} {r.actorUserId?.slice(0, 8)}</td><td className="font-mono">{r.action}</td><td>{r.organizationId?.slice(0, 8)}</td><td>{r.targetType} {r.targetId?.slice(0, 8)}</td><td className="max-w-xs truncate font-mono" title={JSON.stringify(r.metadata)}>{JSON.stringify(r.metadata)}</td></tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
