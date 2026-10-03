import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireStaffPage } from "@/lib/context";
import { db, schema } from "@/lib/db";
import { ORDER_STATUS_LABELS } from "@/lib/services/orders";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge, PageHeader, Panel } from "@/components/ui";

export default async function AdminOrders() {
  await requireStaffPage("platform.service.manage");
  const rows = await db.select({ order: schema.serviceOrder, org: schema.organization.name }).from(schema.serviceOrder).innerJoin(schema.organization, eq(schema.organization.id, schema.serviceOrder.organizationId)).orderBy(desc(schema.serviceOrder.updatedAt)).limit(200);
  return (
    <>
      <PageHeader title="Commandes de création accompagnée" />
      <Panel>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted"><tr><th className="py-2">Organisation</th><th>Date</th><th>Montant</th><th>Payée</th><th>Statut</th><th>Remboursement</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ order, org }) => (
              <tr key={order.id}>
                <td className="py-2"><Link href={`/admin/prestations/${order.id}`} className="font-semibold text-brand hover:underline">{org}</Link></td>
                <td>{formatDate(order.createdAt)}</td><td>{formatMoney(order.amountCents, order.currency)}</td><td>{order.paidAt ? formatDate(order.paidAt) : "—"}</td>
                <td><Badge>{ORDER_STATUS_LABELS[order.status]}</Badge></td><td>{order.refundRequestedAt ? <Badge tone="warning">demandé</Badge> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
