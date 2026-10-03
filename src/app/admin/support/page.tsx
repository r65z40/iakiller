import Link from "next/link";
import { requireStaffPage } from "@/lib/context";
import { staffListTickets } from "@/lib/support/service";
import { formatDateTime } from "@/lib/format";
import { Badge, PageHeader, Panel } from "@/components/ui";

export default async function AdminSupport({ searchParams }: PageProps<"/admin/support">) {
  const staff = await requireStaffPage("platform.support.respond");
  const sp = await searchParams;
  const status = typeof sp.statut === "string" ? sp.statut : undefined;
  const tickets = await staffListTickets(staff, status);
  return (
    <>
      <PageHeader title="Support" actions={<div className="flex gap-2 text-sm">{[["", "Tous"], ["open", "Ouverts"], ["pending", "En attente client"], ["closed", "Clôturés"]].map(([k, l]) => <Link key={k} href={k ? `/admin/support?statut=${k}` : "/admin/support"} className="text-brand underline">{l}</Link>)}</div>} />
      <Panel>
        <ul className="divide-y divide-line">
          {tickets.map(({ ticket, orgName, userEmail }) => (
            <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <Link href={`/admin/support/${ticket.id}`} className="font-semibold text-brand hover:underline">{ticket.subject}</Link>
              <span className="text-muted">{orgName} · {userEmail} · {formatDateTime(ticket.updatedAt)} <Badge>{ticket.status}</Badge></span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
