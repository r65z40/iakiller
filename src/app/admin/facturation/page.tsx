import { DownloadLink } from "@/components/ui/DownloadLink";
import { requireStaffPage } from "@/lib/context";
import { billingEvents } from "@/lib/admin/service";
import { platformCan } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { Badge, PageHeader, Panel } from "@/components/ui";

export default async function AdminBilling() {
  const staff = await requireStaffPage("platform.billing.sync");
  const events = await billingEvents(staff);
  return (
    <>
      <PageHeader title="Facturation" description="Journal des webhooks Stripe. Un événement en échec est rejoué par Stripe ; la réconciliation planifiée relit l'état courant." actions={platformCan(staff.platformRole, "platform.finance.export") && <DownloadLink href="/admin/facturation/export" className="text-sm font-semibold text-brand underline">Export financier (CSV)</DownloadLink>} />
      <Panel>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted"><tr><th className="py-2">Reçu</th><th>Type</th><th>Mode</th><th>Statut</th><th>Erreur</th></tr></thead>
          <tbody className="divide-y divide-line">
            {events.map((e) => (
              <tr key={e.id}><td className="py-2">{formatDateTime(e.receivedAt)}</td><td className="font-mono text-xs">{e.type}</td><td>{e.livemode ? "production" : "test"}</td><td><Badge tone={e.status === "failed" ? "danger" : e.status === "processed" ? "success" : "neutral"}>{e.status}</Badge></td><td className="text-xs text-danger">{e.error}</td></tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
