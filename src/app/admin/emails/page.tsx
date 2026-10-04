import { desc, eq } from "drizzle-orm";
import { requireStaffPage } from "@/lib/context";
import { db, schema } from "@/lib/db";
import { emailMode } from "@/lib/email/send";
import { formatDateTime } from "@/lib/format";
import { Badge, PageHeader, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS = { "": "Tous", sent: "Envoyés", logged: "Journalisés", failed: "Échecs", pending: "En attente" } as const;
const STATUS_TONE: Record<string, "success" | "warning" | "danger" | undefined> = { sent: "success", logged: "warning", failed: "danger", pending: "warning" };
const STATUS_LABEL: Record<string, string> = { sent: "Envoyé", logged: "Journalisé", failed: "Échec", pending: "En attente" };

export default async function AdminEmails({ searchParams }: PageProps<"/admin/emails">) {
  await requireStaffPage("platform.audit.view");
  const sp = await searchParams;
  const status = typeof sp.statut === "string" && sp.statut in STATUS && sp.statut !== "" ? sp.statut : "";
  const rows = await db
    .select()
    .from(schema.emailOutbox)
    .where(status ? eq(schema.emailOutbox.status, status) : undefined)
    .orderBy(desc(schema.emailOutbox.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader
        title="Emails envoyés"
        description={emailMode() === "log" ? "Mode « journalisé » : les emails ne sont PAS réellement envoyés, seulement enregistrés ici. Configurez SMTP pour l'envoi réel." : "Mode SMTP : les emails sont réellement envoyés. Voici les 200 derniers, avec leur statut de livraison."}
      />
      <nav aria-label="Filtrer par statut" className="mb-4 flex flex-wrap gap-2">
        {Object.entries(STATUS).map(([k, label]) => (
          <a key={k} href={k ? `/admin/emails?statut=${k}` : "/admin/emails"} aria-current={status === k ? "page" : undefined} className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${status === k ? "bg-ink text-white ring-ink" : "bg-white ring-line"}`}>{label}</a>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Panel><p className="text-sm text-muted">Aucun email pour ce filtre.</p></Panel>
      ) : (
        <ul className="space-y-3">
          {rows.map((e) => (
            <li key={e.id} className="rounded-xl bg-white p-4 ring-1 ring-line">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">{formatDateTime(e.createdAt)} · <span className="font-mono">{e.template}</span> · à {e.to}</p>
                <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status] ?? e.status}{e.sentAt ? ` · ${formatDateTime(e.sentAt)}` : ""}</Badge>
              </div>
              <p className="mt-1 font-bold">{e.subject}</p>
              {e.error && <p className="mt-1 text-xs font-semibold text-danger">Erreur : {e.error}</p>}
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-semibold text-brand">Voir le contenu</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-surface p-3 text-sm">{e.text}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
