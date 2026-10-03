/**
 * Diagnostic d'installation : `npm run doctor`.
 * Vérifie la configuration, les connexions et les dépendances système, sans rien modifier
 * (hormis un petit fichier de test écrit puis supprimé dans chaque stockage).
 * Code de sortie 1 si un point bloquant est détecté.
 */
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { databaseUrl, db, pool } from "../src/lib/db";
import { storage } from "../src/lib/media/storage";
import { backupDestination } from "../src/lib/backup/destination";
import { backupKeyFromEnv } from "../src/lib/backup/crypto";
import { pgToolsVersion, sameDatabase } from "../src/lib/backup/pg";

type Level = "ok" | "warn" | "fail";
const results: { level: Level; label: string; detail: string }[] = [];
const report = (level: Level, label: string, detail = "") => results.push({ level, label, detail });
const production = process.env.NODE_ENV === "production" || (process.env.APP_URL ?? "").startsWith("https://");

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    report("fail", label, e instanceof Error ? e.message : String(e));
  }
}

async function roundTrip(store: { put: (k: string, b: Buffer, t: string) => Promise<void>; get: (k: string) => Promise<Buffer | null>; delete: (k: string) => Promise<void> }) {
  const key = `doctor/${Date.now()}.txt`;
  await store.put(key, Buffer.from("ok"), "text/plain");
  const back = await store.get(key);
  await store.delete(key);
  if (back?.toString() !== "ok") throw new Error("écriture puis relecture impossible");
}

async function main() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  report(major > 20 || (major === 20 && minor >= 9) ? "ok" : "fail", "Node.js", process.versions.node + (major < 22 ? " (22 LTS recommandé)" : ""));

  let serverMajor = 0;
  await check("Base de données", async () => {
    const r = await db.execute(sql`show server_version`);
    const version = String((r.rows[0] as { server_version: string }).server_version);
    serverMajor = Number(version.split(".")[0]);
    report(serverMajor >= 16 ? "ok" : "warn", "Base de données", `PostgreSQL ${version}${serverMajor < 16 ? " (16 recommandé)" : ""}`);
  });

  await check("Migrations", async () => {
    const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as { entries: unknown[] };
    const r = await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`).catch(() => ({ rows: [{ n: 0 }] }));
    const applied = Number((r.rows[0] as { n: number }).n);
    report(applied >= journal.entries.length ? "ok" : "fail", "Migrations", applied >= journal.entries.length ? `${applied} appliquée(s)` : `${applied}/${journal.entries.length} appliquée(s) : lancez npm run db:migrate`);
  });

  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  report(secret.length >= 32 ? "ok" : "fail", "Secret d'authentification", secret ? `${secret.length} caractères${secret.length < 32 ? " (32 minimum : openssl rand -base64 48)" : ""}` : "BETTER_AUTH_SECRET manquant");

  const appUrl = process.env.APP_URL ?? "";
  report(!appUrl ? "fail" : production && !appUrl.startsWith("https://") ? "fail" : "ok", "Adresse de l'application", appUrl || "APP_URL manquant");

  const emailMode = process.env.EMAIL_MODE === "smtp" ? "smtp" : "log";
  if (emailMode === "smtp") {
    await check("Emails (SMTP)", async () => {
      const nodemailer = (await import("nodemailer")).default;
      await nodemailer.createTransport(process.env.SMTP_URL).verify();
      report("ok", "Emails (SMTP)", "connexion vérifiée");
    });
  } else report(production ? "fail" : "warn", "Emails", "EMAIL_MODE=log : aucun email n'est envoyé (développement uniquement)");

  await check("Stockage des médias", async () => {
    await roundTrip(storage());
    const s3 = process.env.STORAGE_DRIVER === "s3";
    report(s3 || !production ? "ok" : "warn", "Stockage des médias", s3 ? `S3 · ${process.env.S3_BUCKET}` : `disque local · ${process.env.LOCAL_STORAGE_DIR || "./storage"}`);
  });

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  if (!stripeKey) report(production ? "warn" : "ok", "Paiement", "Stripe non configuré : souscription désactivée");
  else if (stripeKey.startsWith("sk_live_") && process.env.STRIPE_ALLOW_LIVE !== "true") report("fail", "Paiement", "clé live sans STRIPE_ALLOW_LIVE=true");
  else report(process.env.STRIPE_WEBHOOK_SECRET ? "ok" : "fail", "Paiement", `${stripeKey.startsWith("sk_live_") ? "Stripe PRODUCTION" : "Stripe test"}${process.env.STRIPE_WEBHOOK_SECRET ? "" : " · STRIPE_WEBHOOK_SECRET manquant"}`);

  const tools = await pgToolsVersion();
  const toolsMajor = Number(tools?.match(/(\d+)\./)?.[1] ?? 0);
  report(!tools ? "fail" : serverMajor && toolsMajor < serverMajor ? "fail" : "ok", "Outils de sauvegarde", tools ? `${tools}${serverMajor && toolsMajor < serverMajor ? ` : version inférieure au serveur (${serverMajor})` : ""}` : "pg_dump introuvable (paquet postgresql-client)");

  await check("Destination des sauvegardes", async () => {
    const dest = backupDestination();
    if (!dest) {
      report(production ? "fail" : "warn", "Destination des sauvegardes", "BACKUP_DRIVER=off ou bucket manquant");
      return;
    }
    await roundTrip(dest.store);
    report(production && dest.kind === "local" ? "warn" : "ok", "Destination des sauvegardes", dest.label + (production && dest.kind === "local" ? " (même serveur : préférez un bucket S3 externe)" : ""));
  });

  await check("Chiffrement des sauvegardes", async () => {
    const key = backupKeyFromEnv();
    report(key ? "ok" : production ? "warn" : "ok", "Chiffrement des sauvegardes", key ? "AES-256-GCM" : "désactivé (BACKUP_ENCRYPTION_KEY vide)");
  });

  const restoreDb = process.env.BACKUP_RESTORE_TEST_DATABASE_URL;
  if (!restoreDb) report("warn", "Essai de restauration", "BACKUP_RESTORE_TEST_DATABASE_URL non défini : pas d'essai automatique");
  else report(sameDatabase(restoreDb, databaseUrl()) ? "fail" : "ok", "Essai de restauration", sameDatabase(restoreDb, databaseUrl()) ? "pointe vers la base de production !" : "base de test configurée");

  await check("Administrateur", async () => {
    const r = await db.execute(sql`select count(*) filter (where two_factor_enabled)::int as secured, count(*)::int as total from "user" where platform_role = 'admin'`);
    const { secured, total } = r.rows[0] as { secured: number; total: number };
    report(total === 0 ? "warn" : secured === 0 ? "warn" : "ok", "Administrateur", total === 0 ? "aucun : npm run admin:create -- --email …" : `${total} compte(s), ${secured} avec double authentification`);
  });

  await check("Tâches planifiées", async () => {
    const r = await db.execute(sql`select max(started_at) as last from job_run`);
    const last = (r.rows[0] as { last: Date | null }).last;
    const recent = last && Date.now() - new Date(last).getTime() < 30 * 60_000;
    report(recent ? "ok" : "warn", "Tâches planifiées", last ? `dernière exécution : ${new Date(last).toISOString()}${recent ? "" : " (plus de 30 min)"}` : "jamais exécutées : planifiez npm run jobs toutes les 15 min");
  });

  const icon = { ok: "✓", warn: "!", fail: "✗" };
  for (const r of results) console.log(`${icon[r.level]} ${r.label.padEnd(30)} ${r.detail}`);
  const fails = results.filter((r) => r.level === "fail").length;
  const warns = results.filter((r) => r.level === "warn").length;
  console.log(`\n${fails} bloquant(s), ${warns} avertissement(s).`);
  if (fails) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => undefined));
