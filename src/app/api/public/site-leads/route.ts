import { getSettings } from "@/lib/settings/store";
import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { submitSiteLead } from "@/lib/sites/leads";
import { clientIp, ipFingerprint } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/origin";

export async function POST(req: Request) {
  await getSettings();
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
  const result = await submitSiteLead(body, { ipKey: ipFingerprint(clientIp(h)) });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
