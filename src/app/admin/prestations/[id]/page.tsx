import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireStaffPage } from "@/lib/context";
import { db, schema } from "@/lib/db";
import { listOrderMessages, ORDER_STATUS_LABELS } from "@/lib/services/orders";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Alert, Button, PageHeader, Panel } from "@/components/ui";
import { Flash } from "../../_lib/Flash";
import { orderDraftAction, orderMessageAdminAction, orderStatusAction } from "../../_lib/actions";

const NEXT: Record<string, string[]> = { brief_received: ["in_progress", "cancelled"], in_progress: ["client_review"], revisions: ["client_review"], delivered: ["closed"], requested: ["cancelled"], awaiting_payment: ["cancelled"] };

export default async function AdminOrder({ params, searchParams }: PageProps<"/admin/prestations/[id]">) {
  await requireStaffPage("platform.service.manage");
  const { id } = await params;
  const sp = await searchParams;
  const [row] = await db.select({ order: schema.serviceOrder, org: schema.organization }).from(schema.serviceOrder).innerJoin(schema.organization, eq(schema.organization.id, schema.serviceOrder.organizationId)).where(eq(schema.serviceOrder.id, id));
  if (!row) notFound();
  const { order, org } = row;
  const messages = await listOrderMessages(order.id, org.id);
  const brief = order.brief as Record<string, string>;
  return (
    <div className="max-w-4xl">
      <PageHeader title={`Commande de ${org.name}`} description={`${formatMoney(order.amountCents, order.currency)} · ${ORDER_STATUS_LABELS[order.status]} · corrections ${order.revisionsUsed}/${order.includedRevisions}`} />
      <Flash sp={sp} />
      {order.refundRequestedAt && <div className="mb-4"><Alert tone="warning" title="Remboursement demandé">{order.refundNote} — à traiter manuellement dans Stripe selon les conditions validées (aucune automatisation).</Alert></div>}
      <Panel title="Actions" className="mb-6">
        <div className="flex flex-wrap gap-2">
          {order.paidAt && !order.cardId && <form action={orderDraftAction}><input type="hidden" name="id" value={order.id} /><Button size="sm">Créer le brouillon dans l&apos;organisation</Button></form>}
          {(NEXT[order.status] ?? []).map((s) => (
            <form key={s} action={orderStatusAction}><input type="hidden" name="id" value={order.id} /><input type="hidden" name="status" value={s} /><Button size="sm" variant={s === "cancelled" ? "ghost" : "secondary"}>→ {ORDER_STATUS_LABELS[s]}</Button></form>
          ))}
        </div>
        {order.cardId && <p className="mt-3 text-sm text-muted">Brouillon créé (carte {order.cardId}). Pour le modifier : ouvrez un accès d&apos;assistance sur l&apos;organisation puis entrez en mode assistance. La publication reste à l&apos;initiative du client.</p>}
      </Panel>
      <Panel title="Brief" className="mb-6"><dl className="space-y-2 text-sm">{Object.entries(brief).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="font-semibold">{k}</dt><dd className="whitespace-pre-wrap text-muted">{v}</dd></div>)}</dl></Panel>
      <Panel title="Échanges">
        <ul className="space-y-2">{messages.map(({ message, author }) => <li key={message.id} className={`rounded-lg p-3 text-sm ${message.fromPlatform ? "bg-brand-soft" : "bg-surface"}`}><p className="text-xs text-muted">{author} · {formatDateTime(message.createdAt)}</p><p className="whitespace-pre-wrap">{message.body}</p></li>)}</ul>
        <form action={orderMessageAdminAction} className="mt-3 space-y-2"><input type="hidden" name="id" value={order.id} /><textarea name="body" required rows={3} aria-label="Message au client" className="block w-full rounded-lg border border-line p-2 text-sm" /><Button size="sm">Envoyer au client</Button></form>
      </Panel>
    </div>
  );
}
