import { and, desc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { Pool } from "pg";
import { databaseUrl, db, pool, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { storage, type ObjectStorage } from "@/lib/media/storage";
import { getSettings } from "@/lib/settings/store";
import { backupKeyFromEnv, decrypt, encrypt, keyFingerprint, sha256 } from "./crypto";
import { backupDestination, type BackupDestination } from "./destination";
import { pgDump, pgRestore, pgRestoreList, sameDatabase } from "./pg";
import { selectRetained } from "./policy";

/**
 * Sauvegardes complètes de la plateforme : base PostgreSQL (pg_dump) + fichiers des
 * médias. Organisation dans la destination :
 *
 *   index.json                        liste des sauvegardes (restauration sans la base)
 *   snapshots/{id}/manifest.json      contenu, empreintes SHA-256, comptages
 *   snapshots/{id}/database.dump[.enc]
 *   media/{clé de stockage}[.enc]     fichiers partagés entre sauvegardes (incrémental)
 *
 * Un média est immuable (un recadrage crée un nouveau média) : un fichier déjà présent
 * dans la sauvegarde précédente est réutilisé au lieu d'être recopié. La base est
 * exportée intégralement à chaque fois.
 */

export const MANIFEST_FORMAT = "carto-backup";

export interface ManifestMedia {
  storageKey: string;
  objectKey: string;
  mimeType: string;
  bytes: number;
  sha256: string;
}

export interface BackupManifest {
  format: typeof MANIFEST_FORMAT;
  version: 1;
  id: string;
  startedAt: string;
  finishedAt: string;
  trigger: string;
  encrypted: boolean;
  keyFingerprint: string | null;
  migrations: { count: number; lastAppliedAt: number | null } | null;
  database: { objectKey: string; bytes: number; sha256: string; tocEntries: number };
  media: ManifestMedia[];
  missingFiles: string[];
  counts: Record<string, number>;
}

interface IndexEntry {
  id: string;
  startedAt: string;
  manifestKey: string;
  encrypted: boolean;
}

const INDEX_KEY = "index.json";
const LOCK_KEY = 0x5ca7e5; // verrou consultatif PostgreSQL propre aux sauvegardes
const STALE_RUNNING_MS = 6 * 3600_000;

type Row = typeof schema.backupRun.$inferSelect;

function requireDestination(): BackupDestination {
  const dest = backupDestination();
  if (!dest) throw new DomainError("not_configured", "Aucune destination de sauvegarde configurée (BACKUP_DRIVER).");
  return dest;
}

/** Exclusion mutuelle entre instances (sauvegarde, suppression, rétention). */
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>("select pg_try_advisory_lock($1) as ok", [LOCK_KEY]);
    if (!rows[0]?.ok) throw new DomainError("conflict", "Une opération de sauvegarde est déjà en cours.");
    try {
      return await fn();
    } finally {
      await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => undefined);
    }
  } finally {
    client.release();
  }
}

async function readJson<T>(store: ObjectStorage, key: string): Promise<T | null> {
  const buf = await store.get(key);
  if (!buf) return null;
  try {
    return JSON.parse(buf.toString("utf8")) as T;
  } catch {
    return null;
  }
}

const json = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2));

export async function readIndex(store: ObjectStorage): Promise<IndexEntry[]> {
  return (await readJson<{ backups: IndexEntry[] }>(store, INDEX_KEY))?.backups ?? [];
}

async function writeIndex(store: ObjectStorage, entries: IndexEntry[]) {
  entries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  await store.put(INDEX_KEY, json({ format: MANIFEST_FORMAT, updatedAt: new Date().toISOString(), backups: entries }), "application/json");
}

export async function readManifest(store: ObjectStorage, id: string): Promise<BackupManifest> {
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(id)) throw new DomainError("invalid", "Identifiant de sauvegarde invalide.");
  const m = await readJson<BackupManifest>(store, `snapshots/${id}/manifest.json`);
  if (!m || m.format !== MANIFEST_FORMAT) throw new DomainError("not_found", "Sauvegarde introuvable dans la destination.");
  return m;
}

function keyFor(manifest: { encrypted: boolean; keyFingerprint: string | null }): Buffer | null {
  if (!manifest.encrypted) return null;
  const key = backupKeyFromEnv();
  if (!key) throw new DomainError("not_configured", "Cette sauvegarde est chiffrée : BACKUP_ENCRYPTION_KEY est requis.");
  if (manifest.keyFingerprint && keyFingerprint(key) !== manifest.keyFingerprint) {
    throw new DomainError("invalid", "BACKUP_ENCRYPTION_KEY ne correspond pas à la clé utilisée pour cette sauvegarde.");
  }
  return key;
}

async function readObject(store: ObjectStorage, objectKey: string, key: Buffer | null, expectedSha: string): Promise<Buffer> {
  const raw = await store.get(objectKey);
  if (!raw) throw new Error(`Objet manquant : ${objectKey}`);
  const plain = key ? decrypt(raw, key) : raw;
  if (sha256(plain) !== expectedSha) throw new Error(`Empreinte incorrecte : ${objectKey}`);
  return plain;
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

const COUNTED_TABLES = ["user", "organization", "card", "card_version", "media_asset", "lead", "subscription", "audit_log"];

/**
 * Lit, dans un instantané PostgreSQL figé, tout ce qui doit être cohérent avec l'export :
 * comptages, migrations appliquées et liste des médias. pg_dump utilise ensuite le même
 * instantané (--snapshot) : une écriture pendant la sauvegarde ne crée aucun écart.
 */
async function withSnapshot<T>(fn: (snapshot: string, q: <R>(text: string) => Promise<R[]>) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const { rows } = await client.query<{ id: string }>("select pg_export_snapshot() as id");
    const q = async <R,>(text: string) => (await client.query(text)).rows as R[];
    const out = await fn(rows[0].id, q);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** Dernière sauvegarde réussie dont le manifeste est lisible (base de l'incrémental). */
async function previousManifest(store: ObjectStorage): Promise<BackupManifest | null> {
  const rows = await db
    .select({ id: schema.backupRun.id })
    .from(schema.backupRun)
    .where(and(eq(schema.backupRun.status, "ok"), isNull(schema.backupRun.deletedAt), sql`coalesce(${schema.backupRun.verifyStatus}, 'ok') = 'ok'`))
    .orderBy(desc(schema.backupRun.startedAt))
    .limit(1);
  if (!rows[0]) return null;
  return readManifest(store, rows[0].id).catch(() => null);
}

export interface RunOptions {
  trigger: "scheduled" | "manual" | "cli";
  actorUserId?: string | null;
  /** Recopie tous les fichiers même s'ils figurent dans la sauvegarde précédente. */
  full?: boolean;
}

/** Réserve une sauvegarde (ligne « running ») ; à utiliser avant de lancer `executeBackup`. */
export async function startBackup(opts: RunOptions): Promise<string> {
  requireDestination();
  await db
    .update(schema.backupRun)
    .set({ status: "failed", finishedAt: new Date(), error: "Interrompue (délai dépassé ou arrêt du serveur)." })
    .where(and(eq(schema.backupRun.status, "running"), lt(schema.backupRun.startedAt, new Date(Date.now() - STALE_RUNNING_MS))));
  const id = newId();
  try {
    await db.insert(schema.backupRun).values({ id, status: "running", trigger: opts.trigger, createdById: opts.actorUserId ?? null });
  } catch {
    throw new DomainError("conflict", "Une sauvegarde est déjà en cours.");
  }
  return id;
}

/** Exécute une sauvegarde réservée. Ne lève pas d'erreur : le résultat est dans la ligne. */
export async function executeBackup(id: string, opts: RunOptions): Promise<Row> {
  const dest = requireDestination();
  const store = dest.store;
  const written: string[] = [];
  try {
    return await withLock(async () => {
      const key = backupKeyFromEnv();
      const fingerprint = key ? keyFingerprint(key) : null;
      const prefix = `snapshots/${id}/`;
      const [row] = await db.select().from(schema.backupRun).where(eq(schema.backupRun.id, id));
      const startedAt = row?.startedAt ?? new Date();

      // 1. Base de données, comptages et liste des médias dans le même instantané.
      const { dump, assets, tableCounts, migrations } = await withSnapshot(async (snapshot, q) => {
        const tableCounts: Record<string, number> = {};
        for (const t of COUNTED_TABLES) tableCounts[t] = Number((await q<{ n: number }>(`select count(*)::int as n from "${t}"`))[0].n);
        const hasMigrations = (await q<{ ok: boolean }>("select to_regclass('drizzle.__drizzle_migrations') is not null as ok"))[0].ok;
        const migrations = hasMigrations
          ? await q<{ n: number; last: string | null }>("select count(*)::int as n, max(created_at)::bigint as last from drizzle.__drizzle_migrations").then((r) => ({
              count: Number(r[0].n),
              lastAppliedAt: r[0].last ? Number(r[0].last) : null,
            }))
          : null;
        const assets = await q<{ storageKey: string; mimeType: string; deletedAt: Date | null }>(
          `select storage_key as "storageKey", mime_type as "mimeType", deleted_at as "deletedAt" from media_asset`,
        );
        const dump = await pgDump(databaseUrl(), snapshot);
        return { dump, assets, tableCounts, migrations };
      });
      const tocEntries = await pgRestoreList(dump);
      const dbObjectKey = `${prefix}database.dump${key ? ".enc" : ""}`;
      const dbStored = key ? encrypt(dump, key) : dump;
      await store.put(dbObjectKey, dbStored, "application/octet-stream");
      written.push(dbObjectKey);
      let writtenBytes = dbStored.length;

      // 2. Fichiers (incrémental).
      const prev = opts.full ? null : await previousManifest(store);
      const prevByKey = new Map(
        (prev && prev.encrypted === !!key && prev.keyFingerprint === fingerprint ? prev.media : []).map((m) => [m.storageKey, m]),
      );
      const media: ManifestMedia[] = [];
      const missing: string[] = [];
      let copied = 0;
      const reused = new Set<string>();
      await mapLimit(assets, 8, async (a) => {
        const known = prevByKey.get(a.storageKey);
        if (known) {
          media.push(known);
          reused.add(known.objectKey);
          return;
        }
        const body = await storage().get(a.storageKey);
        if (!body) {
          // Un média supprimé peut ne plus avoir de fichier ; un média actif sans fichier est signalé.
          if (!a.deletedAt) missing.push(a.storageKey);
          return;
        }
        const objectKey = `media/${a.storageKey}${key ? ".enc" : ""}`;
        const stored = key ? encrypt(body, key) : body;
        await store.put(objectKey, stored, "application/octet-stream");
        written.push(objectKey);
        writtenBytes += stored.length;
        copied++;
        media.push({ storageKey: a.storageKey, objectKey, mimeType: a.mimeType, bytes: body.length, sha256: sha256(body) });
      });
      media.sort((x, y) => x.storageKey.localeCompare(y.storageKey));

      // 3. Manifeste et index.
      const manifest: BackupManifest = {
        format: MANIFEST_FORMAT,
        version: 1,
        id,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        trigger: opts.trigger,
        encrypted: !!key,
        keyFingerprint: fingerprint,
        migrations,
        database: { objectKey: dbObjectKey, bytes: dump.length, sha256: sha256(dump), tocEntries },
        media,
        missingFiles: missing,
        counts: tableCounts,
      };
      const manifestKey = `${prefix}manifest.json`;
      await store.put(manifestKey, json(manifest), "application/json");
      written.push(manifestKey);
      const index = (await readIndex(store)).filter((e) => e.id !== id);
      index.push({ id, startedAt: manifest.startedAt, manifestKey, encrypted: manifest.encrypted });
      await writeIndex(store, index);

      // 4. Vérification immédiate de ce qui vient d'être écrit (relecture + empreintes).
      await readObject(store, dbObjectKey, key, manifest.database.sha256);
      for (const m of media) if (!reused.has(m.objectKey)) await readObject(store, m.objectKey, key, m.sha256);

      const [done] = await db
        .update(schema.backupRun)
        .set({
          status: "ok",
          finishedAt: new Date(),
          manifestKey,
          encrypted: manifest.encrypted,
          dbBytes: dump.length,
          writtenBytes,
          mediaCount: media.length,
          mediaCopied: copied,
          missingFiles: missing.length,
          verifiedAt: new Date(),
          verifyStatus: "ok",
          verifyDetail: "Vérifiée à la création (fichiers écrits relus).",
        })
        .where(eq(schema.backupRun.id, id))
        .returning();
      await audit({ actorUserId: opts.actorUserId ?? null, actorType: opts.actorUserId ? "staff" : "system", action: "backup.created", targetType: "backup", targetId: id, metadata: { trigger: opts.trigger, mediaCount: media.length, copied, writtenBytes } });
      return done;
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Nettoyage des fichiers propres à cette sauvegarde. Les fichiers de médias restent :
    // une sauvegarde plus ancienne peut utiliser la même clé, et ils seront réutilisés.
    for (const k of written) if (k.startsWith(`snapshots/${id}/`)) await store.delete(k).catch(() => undefined);
    const [failed] = await db
      .update(schema.backupRun)
      .set({ status: "failed", finishedAt: new Date(), error: message.slice(0, 2000) })
      .where(eq(schema.backupRun.id, id))
      .returning();
    console.error("[backup] échec", message);
    await notifyFailure(failed ?? null, message).catch(() => undefined);
    return failed;
  }
}

/** Sauvegarde complète, en une fois (tâche planifiée, ligne de commande). */
export async function runBackup(opts: RunOptions): Promise<Row> {
  const id = await startBackup(opts);
  return executeBackup(id, opts);
}

async function notifyFailure(row: Row | null, message: string) {
  const { sendEmail } = await import("@/lib/email/send");
  const { templates } = await import("@/lib/email/templates");
  const { appUrl } = await import("@/lib/config");
  const settings = await getSettings();
  const to = settings.backup.alertEmail || settings.brand.supportEmail;
  if (!to || to.endsWith(".invalid")) return;
  await sendEmail({ to, template: "backupFailed", email: templates.backupFailed({ error: message.slice(0, 500), url: `${appUrl()}/admin/sauvegardes` }), dedupeKey: `backup-failed:${row?.id ?? Date.now()}` });
}

export interface VerifyResult {
  ok: boolean;
  detail: string;
  checkedFiles: number;
}

/** Vérification complète : relecture, déchiffrement et empreinte de chaque objet, lecture de l'export par pg_restore. */
export async function verifyBackup(id: string, actorUserId?: string | null): Promise<VerifyResult> {
  const { store } = requireDestination();
  let result: VerifyResult;
  try {
    const manifest = await readManifest(store, id);
    const key = keyFor(manifest);
    const dump = await readObject(store, manifest.database.objectKey, key, manifest.database.sha256);
    const toc = await pgRestoreList(dump);
    const errors: string[] = [];
    await mapLimit(manifest.media, 8, async (m) => {
      await readObject(store, m.objectKey, key, m.sha256).catch((e: Error) => errors.push(e.message));
    });
    result = errors.length
      ? { ok: false, detail: `${errors.length} fichier(s) en défaut : ${errors.slice(0, 5).join(" ; ")}`, checkedFiles: manifest.media.length + 1 }
      : { ok: true, detail: `Base lisible (${toc} éléments) et ${manifest.media.length} fichier(s) intacts.`, checkedFiles: manifest.media.length + 1 };
  } catch (e) {
    result = { ok: false, detail: e instanceof Error ? e.message : String(e), checkedFiles: 0 };
  }
  await db
    .update(schema.backupRun)
    .set({ verifiedAt: new Date(), verifyStatus: result.ok ? "ok" : "failed", verifyDetail: result.detail.slice(0, 2000) })
    .where(eq(schema.backupRun.id, id));
  await audit({ actorUserId: actorUserId ?? null, actorType: actorUserId ? "staff" : "system", action: "backup.verified", targetType: "backup", targetId: id, metadata: { ok: result.ok } });
  return result;
}

export interface RestoreOptions {
  id: string;
  targetDatabaseUrl: string;
  /** Où restaurer les fichiers ; null = base seulement. */
  mediaTarget: ObjectStorage | null;
  /** Autorise la restauration dans la base courante (DATABASE_URL). */
  allowCurrentDatabase?: boolean;
  store?: ObjectStorage;
  onProgress?: (msg: string) => void;
}

/** Restauration complète. Utilisable sans la base d'origine (lecture de la destination seule). */
export async function restoreBackup(opts: RestoreOptions): Promise<{ manifest: BackupManifest; counts: Record<string, number>; mediaRestored: number }> {
  const store = opts.store ?? requireDestination().store;
  if (!opts.allowCurrentDatabase && sameDatabase(opts.targetDatabaseUrl, databaseUrl())) {
    throw new DomainError("invalid", "La base cible est la base en service. Restaurez dans une nouvelle base, ou confirmez explicitement le remplacement.");
  }
  const log = opts.onProgress ?? (() => undefined);
  const manifest = await readManifest(store, opts.id);
  const key = keyFor(manifest);
  log(`Sauvegarde ${manifest.id} du ${manifest.startedAt} (${manifest.encrypted ? "chiffrée" : "non chiffrée"}).`);
  const dump = await readObject(store, manifest.database.objectKey, key, manifest.database.sha256);
  log("Restauration de la base…");
  await pgRestore(dump, opts.targetDatabaseUrl);

  const target = new Pool({ connectionString: opts.targetDatabaseUrl, max: 2 });
  const restoredCounts: Record<string, number> = {};
  try {
    // La base a été exportée pendant la sauvegarde : la ligne de suivi y était « running ».
    await target.query("update backup_run set status = 'ok', finished_at = $2, manifest_key = $3 where id = $1 and status = 'running'", [manifest.id, manifest.finishedAt, `snapshots/${manifest.id}/manifest.json`]);
    for (const table of Object.keys(manifest.counts)) {
      if (!COUNTED_TABLES.includes(table)) continue;
      const r = await target.query<{ n: number }>(`select count(*)::int as n from "${table}"`);
      restoredCounts[table] = r.rows[0].n;
    }
  } finally {
    await target.end();
  }

  let mediaRestored = 0;
  if (opts.mediaTarget) {
    log(`Restauration de ${manifest.media.length} fichier(s)…`);
    const mediaTarget = opts.mediaTarget;
    await mapLimit(manifest.media, 8, async (m) => {
      const body = await readObject(store, m.objectKey, key, m.sha256);
      await mediaTarget.put(m.storageKey, body, m.mimeType);
      mediaRestored++;
    });
  }
  return { manifest, counts: restoredCounts, mediaRestored };
}

/**
 * Essai de restauration complète dans une base de test dédiée
 * (BACKUP_RESTORE_TEST_DATABASE_URL), puis comparaison des comptages.
 */
export async function restoreTest(id: string, actorUserId?: string | null): Promise<{ ok: boolean; detail: string }> {
  const target = process.env.BACKUP_RESTORE_TEST_DATABASE_URL;
  if (!target) throw new DomainError("not_configured", "BACKUP_RESTORE_TEST_DATABASE_URL n'est pas configuré.");
  let result: { ok: boolean; detail: string };
  try {
    const { manifest, counts: restored } = await restoreBackup({ id, targetDatabaseUrl: target, mediaTarget: null });
    const diffs = Object.entries(manifest.counts).filter(([t, n]) => restored[t] !== n).map(([t, n]) => `${t} : ${restored[t]} au lieu de ${n}`);
    result = diffs.length ? { ok: false, detail: `Comptages différents : ${diffs.join(", ")}` } : { ok: true, detail: `Restauration complète réussie (${Object.entries(restored).map(([t, n]) => `${t} ${n}`).join(", ")}).` };
  } catch (e) {
    result = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
  await db
    .update(schema.backupRun)
    .set({ restoreTestedAt: new Date(), restoreTestStatus: result.ok ? "ok" : "failed", verifyDetail: result.detail.slice(0, 2000) })
    .where(eq(schema.backupRun.id, id));
  await audit({ actorUserId: actorUserId ?? null, actorType: actorUserId ? "staff" : "system", action: "backup.restore_tested", targetType: "backup", targetId: id, metadata: { ok: result.ok } });
  return result;
}

/** Supprime une sauvegarde et les fichiers qu'aucune autre sauvegarde conservée n'utilise. */
async function deleteUnlocked(row: Row, store: ObjectStorage) {
  if (row.status === "ok" && row.manifestKey) {
    const manifest = await readManifest(store, row.id).catch(() => null);
    if (manifest) {
      const others = await db
        .select({ id: schema.backupRun.id })
        .from(schema.backupRun)
        .where(and(eq(schema.backupRun.status, "ok"), isNull(schema.backupRun.deletedAt), ne(schema.backupRun.id, row.id)));
      const used = new Set<string>();
      for (const o of others) {
        const m = await readManifest(store, o.id).catch(() => null);
        // Par prudence, un manifeste illisible bloque la suppression des fichiers partagés.
        if (!m) return deleteMarkOnly(row, store, false);
        for (const f of m.media) used.add(f.objectKey);
      }
      for (const f of manifest.media) if (!used.has(f.objectKey)) await store.delete(f.objectKey).catch(() => undefined);
      await store.delete(manifest.database.objectKey).catch(() => undefined);
    }
    await store.delete(`snapshots/${row.id}/manifest.json`).catch(() => undefined);
  }
  await deleteMarkOnly(row, store, true);
}

async function deleteMarkOnly(row: Row, store: ObjectStorage, removed: boolean) {
  await writeIndex(store, (await readIndex(store)).filter((e) => e.id !== row.id || !removed));
  await db.update(schema.backupRun).set({ status: removed ? "deleted" : row.status, deletedAt: removed ? new Date() : null }).where(eq(schema.backupRun.id, row.id));
}

export async function deleteBackup(id: string, actorUserId: string) {
  const { store } = requireDestination();
  await withLock(async () => {
    const [row] = await db.select().from(schema.backupRun).where(eq(schema.backupRun.id, id));
    if (!row || row.deletedAt) throw new DomainError("not_found", "Sauvegarde introuvable.");
    if (row.status === "running") throw new DomainError("conflict", "Sauvegarde en cours.");
    const remaining = await db
      .select({ id: schema.backupRun.id })
      .from(schema.backupRun)
      .where(and(eq(schema.backupRun.status, "ok"), isNull(schema.backupRun.deletedAt), ne(schema.backupRun.id, id)));
    if (row.status === "ok" && remaining.length === 0) throw new DomainError("invalid", "Impossible de supprimer la seule sauvegarde réussie.");
    await deleteUnlocked(row, store);
  });
  await audit({ actorUserId, actorType: "staff", action: "backup.deleted", targetType: "backup", targetId: id });
}

/** Applique la politique de rétention (sauvegardes réussies) et efface les traces d'échecs anciens. */
export async function applyBackupRetention(now = new Date()): Promise<{ deleted: number }> {
  const dest = backupDestination();
  if (!dest) return { deleted: 0 };
  const policy = (await getSettings()).backup;
  return withLock(async () => {
    const rows = await db
      .select()
      .from(schema.backupRun)
      .where(and(eq(schema.backupRun.status, "ok"), isNull(schema.backupRun.deletedAt)));
    const keep = selectRetained(rows.map((r) => ({ id: r.id, startedAt: r.startedAt })), policy);
    let deleted = 0;
    for (const r of rows) {
      if (keep.has(r.id)) continue;
      await deleteUnlocked(r, dest.store);
      deleted++;
    }
    const old = new Date(now.getTime() - 30 * 86400_000);
    const failed = await db
      .select({ id: schema.backupRun.id })
      .from(schema.backupRun)
      .where(and(eq(schema.backupRun.status, "failed"), lt(schema.backupRun.startedAt, old)));
    if (failed.length) await db.delete(schema.backupRun).where(inArray(schema.backupRun.id, failed.map((f) => f.id)));
    if (deleted) await audit({ actorType: "system", action: "backup.retention", metadata: { deleted } });
    return { deleted };
  });
}

export async function listBackups(limit = 100) {
  return db.select().from(schema.backupRun).where(isNull(schema.backupRun.deletedAt)).orderBy(desc(schema.backupRun.startedAt)).limit(limit);
}

export async function lastSuccessfulBackup(): Promise<Row | null> {
  const [row] = await db
    .select()
    .from(schema.backupRun)
    .where(and(eq(schema.backupRun.status, "ok"), isNull(schema.backupRun.deletedAt)))
    .orderBy(desc(schema.backupRun.startedAt))
    .limit(1);
  return row ?? null;
}
