import { getOrgContext } from "@/lib/context";
import { exportRows } from "@/lib/analytics/queries";
import { toCsv } from "@/lib/leads/service";
import { EVENT_TYPES } from "@/lib/analytics/service";
import { audit } from "@/lib/audit";

export async function GET(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return new Response("Non autorisé", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const days = Math.min(Number(sp.get("periode") ?? 30) || 30, 365);
  const now = new Date();
  const rows = await exportRows(ctx, { from: new Date(now.getTime() - days * 86400_000), to: now, cardId: sp.get("carte"), memberUserId: sp.get("membre"), includeInternal: sp.get("internes") === "1" });
  await audit({ organizationId: ctx.organization.id, actorUserId: ctx.user.id, actorType: "user", action: "analytics.export" });
  const csv = toCsv(["Jour (Europe/Paris)", "Carte", "Événement", "Source", "Nombre"], rows.map((r) => [r.day, r.card, EVENT_TYPES[r.type as keyof typeof EVENT_TYPES] ?? r.type, r.source, r.count]));
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="statistiques-${days}j.csv"`, "Cache-Control": "no-store" } });
}
