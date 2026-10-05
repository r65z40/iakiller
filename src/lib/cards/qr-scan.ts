import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { TIMEZONE } from "@/lib/format";

function today(): string {
  // AAAA-MM-JJ dans le fuseau de l'application (fr-CA produit ce format).
  return new Date().toLocaleDateString("fr-CA", { timeZone: TIMEZONE });
}

/** Incrémente le compteur de scans d'un QR (agrégé par jour). Best-effort : n'échoue jamais. */
export async function recordQrScan(cardId: string, slug: string | null): Promise<void> {
  try {
    await db
      .insert(schema.qrScan)
      .values({ cardId, slug: slug ?? "", day: today(), count: 1 })
      .onConflictDoUpdate({
        target: [schema.qrScan.cardId, schema.qrScan.slug, schema.qrScan.day],
        set: { count: sql`${schema.qrScan.count} + 1` },
      });
  } catch {
    /* le suivi ne doit jamais bloquer une redirection */
  }
}

/** Total de scans par variante pour une carte : { "" : général, "<slug>" : variante }. */
export async function scansByVariant(cardId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ slug: schema.qrScan.slug, total: sql<number>`sum(${schema.qrScan.count})::int` })
    .from(schema.qrScan)
    .where(eq(schema.qrScan.cardId, cardId))
    .groupBy(schema.qrScan.slug);
  return Object.fromEntries(rows.map((r) => [r.slug, r.total]));
}
