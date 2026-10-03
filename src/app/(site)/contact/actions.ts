"use server";

import { headers } from "next/headers";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { isValidEmail } from "@/lib/validation/urls";
import { clientIp, ipFingerprint, rateLimit } from "@/lib/security/rate-limit";

export async function contactAction(_prev: unknown, fd: FormData): Promise<{ ok: boolean; message: string }> {
  if (String(fd.get("website") ?? "")) return { ok: true, message: "Message envoyé." };
  const ipKey = ipFingerprint(clientIp(await headers()));
  if (!rateLimit(`contact:${ipKey}`, 3, 3600_000)) return { ok: false, message: "Trop de messages envoyés. Réessayez plus tard." };
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  const email = String(fd.get("email") ?? "").trim().slice(0, 254);
  const company = String(fd.get("company") ?? "").trim().slice(0, 120);
  const message = String(fd.get("message") ?? "").trim().slice(0, 4000);
  if (!isValidEmail(email)) return { ok: false, message: "Adresse email invalide." };
  if (message.length < 10) return { ok: false, message: "Votre message est trop court." };
  const id = newId();
  await db.insert(schema.supportTicket).values({ id, organizationId: null, userId: null, subject: `Contact site : ${name || email}`.slice(0, 150) });
  await db.insert(schema.supportMessage).values({ id: newId(), ticketId: id, body: `De : ${name} <${email}>${company ? `\nSociété : ${company}` : ""}\n\n${message}` });
  return { ok: true, message: "Merci, votre message a bien été transmis. Nous vous répondrons par email." };
}
