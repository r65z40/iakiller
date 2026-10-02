import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { submitLead } from "@/lib/leads/service";
import { recordLeadEvent } from "@/lib/analytics/service";
import { clientIp, ipFingerprint } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/origin";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Origine refusée." }, { status: 403 });
  const text = await req.text();
  if (text.length > 10_000) return NextResponse.json({ ok: false, error: "Message trop long." }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const h = await nextHeaders();
  const result = await submitLead(body, { ipKey: ipFingerprint(clientIp(h)) });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  if (typeof body.token === "string" && typeof body.viewId === "string") {
    const [card] = await db.select({ id: schema.card.id, org: schema.card.organizationId }).from(schema.card).where(eq(schema.card.publicToken, body.token));
    if (card) await recordLeadEvent(card.id, card.org, body.viewId).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
