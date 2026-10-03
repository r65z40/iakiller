import { getOrgContext } from "@/lib/context";
import { exportLeadsCsv } from "@/lib/leads/service";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return new Response("Non autorisé", { status: 401 });
  const csv = await exportLeadsCsv(ctx);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="prospects.csv"', "Cache-Control": "no-store" } });
}
