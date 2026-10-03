import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import sharp from "sharp";
import { db, pool, schema } from "@/lib/db";
import { LocalStorage, type ObjectStorage } from "@/lib/media/storage";
import { setBackupDestination } from "@/lib/backup/destination";
import { applyBackupRetention, readIndex, readManifest, restoreBackup, runBackup, startBackup, verifyBackup } from "@/lib/backup/service";
import { saveSection } from "@/lib/settings/store";
import { defaultSettings } from "@/lib/settings/schema";
import { uploadMedia } from "@/lib/media/service";
import { createOrgWithOwner, resetDb } from "../helpers";

const RESTORE_DB = "cartes_restore_test";
const restoreUrl = () => {
  const u = new URL(process.env.DATABASE_URL!);
  u.pathname = `/${RESTORE_DB}`;
  return u.toString();
};

let dir: string;
let store: ObjectStorage;

beforeAll(async () => {
  const exists = await pool.query("select 1 from pg_database where datname = $1", [RESTORE_DB]);
  if (!exists.rowCount) await pool.query(`create database ${RESTORE_DB}`);
});

beforeEach(async () => {
  await resetDb();
  dir = await mkdtemp(path.join(tmpdir(), "sauvegardes-"));
  store = new LocalStorage(dir);
  setBackupDestination({ store, kind: "local", label: dir });
  process.env.BACKUP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  delete process.env.PG_DUMP_PATH;
});

afterAll(async () => {
  setBackupDestination(null);
  delete process.env.BACKUP_ENCRYPTION_KEY;
  await rm(dir, { recursive: true, force: true });
});

async function sampleImage() {
  return sharp({ create: { width: 64, height: 64, channels: 3, background: "#0047BB" } }).png().toBuffer();
}

describe("sauvegardes", () => {
  it("sauvegarde base et fichiers chiffrés, de façon incrémentale, puis restaure tout", async () => {
    const { actor } = await createOrgWithOwner();
    await uploadMedia(actor, { buffer: await sampleImage(), name: "logo.png" }, "image");
    const [media] = await db.select().from(schema.mediaAsset);

    const first = await runBackup({ trigger: "cli" });
    expect(first.status).toBe("ok");
    expect(first.encrypted).toBe(true);
    expect(first.mediaCopied).toBe(1);
    const manifest = await readManifest(store, first.id);
    expect(manifest.counts.organization).toBe(1);
    expect(manifest.media.map((m) => m.storageKey)).toEqual([media.storageKey]);
    expect((await readIndex(store)).map((e) => e.id)).toEqual([first.id]);

    // Le fichier est déjà sauvegardé : la seconde sauvegarde ne le recopie pas.
    const second = await runBackup({ trigger: "cli" });
    expect(second.mediaCopied).toBe(0);
    expect(second.mediaCount).toBe(1);

    // Restauration complète dans une autre base et un autre stockage.
    const mediaDir = await mkdtemp(path.join(tmpdir(), "restaure-"));
    const target = new LocalStorage(mediaDir);
    const restored = await restoreBackup({ id: second.id, targetDatabaseUrl: restoreUrl(), mediaTarget: target });
    expect(restored.counts).toEqual((await readManifest(store, second.id)).counts);
    expect(restored.mediaRestored).toBe(1);
    expect(await target.get(media.storageKey)).not.toBeNull();
    const check = new Pool({ connectionString: restoreUrl(), max: 1 });
    const row = await check.query("select status from backup_run where id = $1", [second.id]);
    await check.end();
    expect(row.rows[0].status).toBe("ok");
    await rm(mediaDir, { recursive: true, force: true });
  });

  it("détecte un fichier altéré et une mauvaise clé", async () => {
    const { actor } = await createOrgWithOwner();
    await uploadMedia(actor, { buffer: await sampleImage(), name: "a.png" }, "image");
    const b = await runBackup({ trigger: "cli" });
    expect((await verifyBackup(b.id)).ok).toBe(true);

    const m = await readManifest(store, b.id);
    const obj = (await store.get(m.media[0].objectKey))!;
    obj[obj.length - 1] ^= 1;
    await store.put(m.media[0].objectKey, obj, "application/octet-stream");
    const v = await verifyBackup(b.id);
    expect(v.ok).toBe(false);
    const [row] = await db.select().from(schema.backupRun).where(eq(schema.backupRun.id, b.id));
    expect(row.verifyStatus).toBe("failed");

    process.env.BACKUP_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    expect((await verifyBackup(b.id)).detail).toMatch(/ne correspond pas/);
  });

  it("refuse de restaurer par-dessus la base en service sans confirmation", async () => {
    const b = await runBackup({ trigger: "cli" });
    await expect(restoreBackup({ id: b.id, targetDatabaseUrl: process.env.DATABASE_URL!, mediaTarget: null })).rejects.toThrow(/base en service/);
  });

  it("une seule sauvegarde à la fois", async () => {
    await startBackup({ trigger: "cli" });
    await expect(startBackup({ trigger: "cli" })).rejects.toThrow(/déjà en cours/);
  });

  it("un échec est journalisé, nettoyé et signalé par email", async () => {
    await saveSection("backup", { ...defaultSettings().backup, alertEmail: "alerte@exemple.test" }, null);
    process.env.PG_DUMP_PATH = "/chemin/inexistant/pg_dump";
    const b = await runBackup({ trigger: "cli" });
    expect(b.status).toBe("failed");
    expect(b.error).toMatch(/introuvable/);
    expect(await readIndex(store)).toEqual([]);
    const mails = await db.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.template, "backupFailed"));
    expect(mails.map((m) => m.to)).toEqual(["alerte@exemple.test"]);
  });

  it("applique la rétention sans supprimer les fichiers encore utilisés", async () => {
    await saveSection("backup", { ...defaultSettings().backup, keepDaily: 1, keepWeekly: 0, keepMonthly: 0 }, null);
    const { actor } = await createOrgWithOwner();
    await uploadMedia(actor, { buffer: await sampleImage(), name: "a.png" }, "image");
    const old = await runBackup({ trigger: "cli" });
    await db.update(schema.backupRun).set({ startedAt: new Date(Date.now() - 3 * 86400_000) }).where(eq(schema.backupRun.id, old.id));
    const recent = await runBackup({ trigger: "cli" });

    expect(await applyBackupRetention()).toEqual({ deleted: 1 });
    expect((await readIndex(store)).map((e) => e.id)).toEqual([recent.id]);
    expect(await store.get(`snapshots/${old.id}/manifest.json`)).toBeNull();
    // Le fichier partagé reste, la sauvegarde conservée est intacte.
    expect((await verifyBackup(recent.id)).ok).toBe(true);
  });
});
