import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/context";
import { staffGetTicket } from "@/lib/support/service";
import { formatDateTime } from "@/lib/format";
import { DomainError } from "@/lib/errors";
import { Button, PageHeader, Panel } from "@/components/ui";
import { Flash } from "../../_lib/Flash";
import { ticketReplyAction } from "../../_lib/actions";

export default async function AdminTicket({ params, searchParams }: PageProps<"/admin/support/[id]">) {
  const staff = await requireStaffPage("platform.support.respond");
  const { id } = await params;
  const sp = await searchParams;
  let data;
  try { data = await staffGetTicket(staff, id); } catch (e) { if (e instanceof DomainError) notFound(); throw e; }
  return (
    <div className="max-w-3xl">
      <PageHeader title={data.ticket.subject} description={`Statut : ${data.ticket.status}`} />
      <Flash sp={sp} />
      <Panel>
        <ul className="space-y-3">{data.messages.map(({ message, author }) => <li key={message.id} className={`rounded-lg p-3 text-sm ${message.fromPlatform ? "bg-brand-soft" : "bg-surface"}`}><p className="text-xs text-muted">{author} · {formatDateTime(message.createdAt)}</p><p className="whitespace-pre-wrap">{message.body}</p>{message.mediaId && <p className="text-xs text-muted">Pièce jointe : média {message.mediaId} (consultable via un accès d&apos;assistance)</p>}</li>)}</ul>
        <form action={ticketReplyAction} className="mt-4 space-y-2">
          <input type="hidden" name="id" value={data.ticket.id} />
          <textarea name="body" required rows={4} aria-label="Réponse" className="block w-full rounded-lg border border-line p-2 text-sm" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="close" /> Clôturer la demande</label>
          <Button size="sm">Répondre (email de notification au client)</Button>
        </form>
      </Panel>
    </div>
  );
}
