import { notFound } from "next/navigation";
import { requireOrgPage } from "@/lib/context";
import { getTicket } from "@/lib/support/service";
import { formatDateTime } from "@/lib/format";
import { DomainError } from "@/lib/errors";
import { PageHeader, Panel } from "@/components/ui";
import { ReplyBox } from "./ReplyBox";

export default async function TicketPage({ params }: PageProps<"/app/assistance/[id]">) {
  const ctx = await requireOrgPage();
  const { id } = await params;
  let data;
  try {
    data = await getTicket(ctx, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  return (
    <div className="max-w-3xl">
      <PageHeader title={data.ticket.subject} description={`Ouverte le ${formatDateTime(data.ticket.createdAt)}`} />
      <Panel>
        <ul className="space-y-3">
          {data.messages.map(({ message, author }) => (
            <li key={message.id} className={`rounded-lg p-3 text-sm ${message.fromPlatform ? "bg-brand-soft" : "bg-surface"}`}>
              <p className="text-xs text-muted">{message.fromPlatform ? "Assistance" : author ?? "Vous"} · {formatDateTime(message.createdAt)}</p>
              <p className="whitespace-pre-wrap">{message.body}</p>
              {message.mediaId && <a href={`/api/media/${message.mediaId}?telecharger=1`} className="text-xs text-brand underline">Pièce jointe</a>}
            </li>
          ))}
        </ul>
        <ReplyBox ticketId={data.ticket.id} />
      </Panel>
    </div>
  );
}
