import path from "node:path";
import { LocalStorage, S3Storage, s3OptionsFromEnv, type ObjectStorage } from "@/lib/media/storage";

/**
 * Destination des sauvegardes, distincte du stockage des médias :
 *   BACKUP_DRIVER=s3     bucket dédié (BACKUP_S3_*, identifiants S3_* en repli)
 *   BACKUP_DRIVER=local  dossier BACKUP_DIR (défaut ./backups) — protège contre les
 *                        erreurs, pas contre la perte du serveur.
 *   BACKUP_DRIVER=off    sauvegardes désactivées.
 */
export interface BackupDestination {
  store: ObjectStorage;
  kind: "local" | "s3";
  label: string;
}

let cached: BackupDestination | null | undefined;

export function backupDestination(): BackupDestination | null {
  if (cached !== undefined) return cached;
  const driver = (process.env.BACKUP_DRIVER || "local").trim();
  if (driver === "off") cached = null;
  else if (driver === "s3") {
    const opts = s3OptionsFromEnv("BACKUP_S3_", "S3_");
    cached = opts ? { store: new S3Storage(opts), kind: "s3", label: `S3 · ${opts.bucket}${opts.endpoint ? ` (${new URL(opts.endpoint).host})` : ""}` } : null;
  } else {
    const dir = path.resolve(/*turbopackIgnore: true*/ process.env.BACKUP_DIR || "./backups");
    cached = { store: new LocalStorage(dir), kind: "local", label: `Dossier local · ${dir}` };
  }
  return cached;
}

/** Réservé aux tests et aux outils en ligne de commande. */
export function setBackupDestination(dest: BackupDestination | null) {
  cached = dest;
}
