import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { brand } from "@/lib/config";
import { settingsSync } from "@/lib/settings/store";
import type { RenderedEmail } from "./templates";

/**
 * Envoi via une boîte d'envoi en base.
 * - EMAIL_MODE=log (défaut hors production) : rien n'est envoyé, l'email est consultable
 *   dans /dev/emails et affiché dans la console.
 * - EMAIL_MODE=smtp : envoi réel via SMTP_URL.
 */
export function emailMode(): "log" | "smtp" {
  return process.env.EMAIL_MODE === "smtp" ? "smtp" : "log";
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransporter() {
  if (!transporter) {
    if (!process.env.SMTP_URL) throw new Error("SMTP_URL manquant alors que EMAIL_MODE=smtp");
    transporter = nodemailer.createTransport(process.env.SMTP_URL);
  }
  return transporter;
}

export async function sendEmail(opts: { to: string; template: string; email: RenderedEmail; dedupeKey?: string }) {
  const id = newId();
  const inserted = await db
    .insert(schema.emailOutbox)
    .values({
      id,
      to: opts.to,
      template: opts.template,
      subject: opts.email.subject,
      text: opts.email.text,
      html: opts.email.html,
      dedupeKey: opts.dedupeKey ?? null,
      status: "pending",
    })
    .onConflictDoNothing({ target: schema.emailOutbox.dedupeKey })
    .returning({ id: schema.emailOutbox.id });
  if (inserted.length === 0) return { skipped: true as const };
  await deliver(id);
  return { skipped: false as const, id };
}

export async function deliver(id: string) {
  const [row] = await db.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.id, id));
  if (!row || (row.status !== "pending" && row.status !== "failed")) return;
  if (emailMode() === "log") {
    if (process.env.NODE_ENV !== "test") {
      console.info(`[email:log] → ${row.to} | ${row.subject}\n${row.text}\n`);
    }
    await db.update(schema.emailOutbox).set({ status: "logged", sentAt: new Date() }).where(eq(schema.emailOutbox.id, id));
    return;
  }
  try {
    await getTransporter().sendMail({
      from: settingsSync().brand.emailFrom || process.env.EMAIL_FROM || `${brand.name} <no-reply@example.invalid>`,
      to: row.to,
      subject: row.subject,
      text: row.text,
      html: row.html,
    });
    await db.update(schema.emailOutbox).set({ status: "sent", sentAt: new Date(), attempts: row.attempts + 1 }).where(eq(schema.emailOutbox.id, id));
  } catch (err) {
    await db
      .update(schema.emailOutbox)
      .set({ status: "failed", attempts: row.attempts + 1, error: String(err).slice(0, 500) })
      .where(eq(schema.emailOutbox.id, id));
  }
}
