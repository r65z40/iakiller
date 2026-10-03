import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { emailMode } from "@/lib/email/send";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Boîte de réception de développement : uniquement hors production ET en mode "log".
 * Permet de suivre les liens de vérification sans envoyer d'email réel.
 */
export default async function DevEmails() {
  if (process.env.NODE_ENV === "production" || emailMode() !== "log") notFound();
  const emails = await db.select().from(schema.emailOutbox).orderBy(desc(schema.emailOutbox.createdAt)).limit(50);
  return (
    <main id="contenu" className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-extrabold">Emails (mode développement)</h1>
      <p className="mt-1 text-sm text-muted">Aucun email n&apos;est réellement envoyé. Liste des 50 derniers messages générés.</p>
      <ul className="mt-6 space-y-4">
        {emails.map((e) => (
          <li key={e.id} className="rounded-xl bg-white p-4 ring-1 ring-line" data-testid="dev-email">
            <p className="text-xs text-muted">{formatDateTime(e.createdAt)} · {e.template} · à {e.to}</p>
            <p className="font-bold">{e.subject}</p>
            <pre className="mt-2 whitespace-pre-wrap break-words text-sm">{e.text}</pre>
          </li>
        ))}
      </ul>
    </main>
  );
}
