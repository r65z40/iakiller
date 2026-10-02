import { requireStaffAction } from "@/lib/context";
import { financeExportRows } from "@/lib/admin/service";
import { toCsv } from "@/lib/leads/service";

export async function GET() {
  let staff;
  try { staff = await requireStaffAction("platform.finance.export"); } catch { return new Response("Accès refusé", { status: 403 }); }
  const rows = await financeExportRows(staff);
  const csv = toCsv(["Date (UTC)", "Organisation", "Numéro", "Statut", "Montant dû (cts)", "Montant payé (cts)", "Devise"], rows.map(({ invoice, orgName }) => [invoice.issuedAt?.toISOString() ?? "", orgName, invoice.number, invoice.status, invoice.amountDueCents, invoice.amountPaidCents, invoice.currency]));
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="factures.csv"', "Cache-Control": "no-store" } });
}
