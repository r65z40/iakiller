import { getSettings } from "@/lib/settings/store";
import { headers as nextHeaders } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getSessionCookie } from "better-auth/cookies";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { recordEvent } from "@/lib/analytics/service";
import { clientIp, ipFingerprint } from "@/lib/security/rate-limit";
import { isSameOrigin } from "@/lib/security/origin";

/** Réception des mesures (beacon). Réponse 204 systématique : rien n'est révélé au client. */
export async function POST(req: Request) {
  await getSettings();
  if (!isSameOrigin(req)) return new Response(null, { status: 204 });
  const text = await req.text();
  if (text.length > 2000) return new Response(null, { status: 204 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 204 });
  }
  const h = await nextHeaders();
  // Visite interne : membre connecté de l'organisation ou personnel de la plateforme.
  let isInternal = false;
  // Sans cookie de session (cas de presque tous les visiteurs), aucune lecture en base.
  const session = getSessionCookie(h) ? await auth.api.getSession({ headers: h }).catch(() => null) : null;
  if (session && typeof body.token === "string") {
    const [u] = await db.select({ role: schema.user.platformRole }).from(schema.user).where(eq(schema.user.id, session.user.id));
    if (u?.role) isInternal = true;
    else {
      const [m] = await db
        .select({ id: schema.membership.id })
        .from(schema.membership)
        .innerJoin(schema.card, eq(schema.card.organizationId, schema.membership.organizationId))
        .where(and(eq(schema.card.publicToken, body.token), eq(schema.membership.userId, session.user.id)))
        .limit(1);
      isInternal = !!m;
    }
  }
  await recordEvent(body, {
    userAgent: h.get("user-agent"),
    // Pays fourni par le proxy/CDN s'il est configuré ; jamais de géolocalisation précise.
    country: h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country") ?? h.get("x-country-code"),
    ipKey: ipFingerprint(clientIp(h)),
    isInternal,
  }).catch((e) => console.error("[analytics]", e));
  return new Response(null, { status: 204 });
}
