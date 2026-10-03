import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSettings } from "@/lib/settings/store";
import { formatDateTime } from "@/lib/format";
import { backupKeyFromEnv } from "./crypto";
import { backupDestination } from "./destination";
import { pgToolsVersion } from "./pg";
import { isBackupDue, isBackupStale } from "./policy";
import { lastSuccessfulBackup } from "./service";

export interface BackupStatus {
  destination: string | null;
  destinationKind: "local" | "s3" | null;
  encrypted: boolean;
  encryptionError: string | null;
  enabled: boolean;
  frequencyHours: number;
  lastSuccessAt: Date | null;
  lastRestoreTestAt: Date | null;
  due: boolean;
  stale: boolean;
  pgTools: string | null;
  restoreTestConfigured: boolean;
  /** Points d'attention, du plus grave au moins grave. */
  warnings: string[];
}

let toolsCache: { at: number; value: string | null } | null = null;

export async function backupStatus(now = new Date()): Promise<BackupStatus> {
  const settings = (await getSettings()).backup;
  const dest = backupDestination();
  let encrypted = false;
  let encryptionError: string | null = null;
  try {
    encrypted = !!backupKeyFromEnv();
  } catch (e) {
    encryptionError = e instanceof Error ? e.message : String(e);
  }
  if (!toolsCache || now.getTime() - toolsCache.at > 600_000) toolsCache = { at: now.getTime(), value: await pgToolsVersion() };
  const last = await lastSuccessfulBackup();
  const [lastRestore] = await db
    .select({ at: schema.backupRun.restoreTestedAt })
    .from(schema.backupRun)
    .where(and(isNotNull(schema.backupRun.restoreTestedAt), eq(schema.backupRun.restoreTestStatus, "ok"), isNull(schema.backupRun.deletedAt)))
    .orderBy(desc(schema.backupRun.restoreTestedAt))
    .limit(1);
  const production = process.env.NODE_ENV === "production";
  const restoreTestConfigured = !!process.env.BACKUP_RESTORE_TEST_DATABASE_URL;
  const stale = isBackupStale(last?.startedAt ?? null, settings.frequencyHours, now);

  const warnings: string[] = [];
  if (!dest) warnings.push("Aucune destination de sauvegarde : définissez BACKUP_DRIVER (s3 recommandé en production).");
  if (encryptionError) warnings.push(encryptionError);
  if (!toolsCache.value) warnings.push("pg_dump est introuvable sur le serveur : installez le client PostgreSQL (même version majeure que la base).");
  if (dest && !settings.enabled) warnings.push("Les sauvegardes automatiques sont désactivées.");
  if (dest && settings.enabled && stale) warnings.push(last ? `Aucune sauvegarde réussie depuis le ${formatDateTime(last.startedAt)}.` : "Aucune sauvegarde réussie pour le moment.");
  if (production && dest?.kind === "local") warnings.push("Destination locale : une panne du serveur emporterait aussi les sauvegardes. Utilisez un bucket S3 chez un autre fournisseur ou dans une autre région.");
  if (production && dest && !encrypted && !encryptionError) warnings.push("Sauvegardes non chiffrées : définissez BACKUP_ENCRYPTION_KEY et conservez la clé hors du serveur.");
  if (!restoreTestConfigured) warnings.push("Aucune base de test de restauration (BACKUP_RESTORE_TEST_DATABASE_URL) : la restauration n'est pas essayée automatiquement.");
  else if (!lastRestore?.at || now.getTime() - lastRestore.at.getTime() > 14 * 86400_000) warnings.push("Aucun essai de restauration réussi depuis plus de 14 jours.");

  return {
    destination: dest?.label ?? null,
    destinationKind: dest?.kind ?? null,
    encrypted,
    encryptionError,
    enabled: settings.enabled,
    frequencyHours: settings.frequencyHours,
    lastSuccessAt: last?.startedAt ?? null,
    lastRestoreTestAt: lastRestore?.at ?? null,
    due: isBackupDue(last?.startedAt ?? null, settings.frequencyHours, now),
    stale,
    pgTools: toolsCache.value,
    restoreTestConfigured,
    warnings,
  };
}
