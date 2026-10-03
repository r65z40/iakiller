import { importTemplateCsv } from "@/lib/cards/import";

export async function GET() {
  return new Response(importTemplateCsv(), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="modele-import-cartes.csv"' } });
}
