/**
 * Installation guidée, en une commande : `npm run setup`.
 *
 * - génère les secrets manquants (clé d'authentification, clé de chiffrement des sauvegardes) ;
 * - écrit le fichier .env (sans écraser des valeurs existantes) ;
 * - crée la base de données si besoin (en local) ;
 * - applique les migrations et les données de départ ;
 * - propose de créer le compte administrateur.
 *
 * Tout est idempotent : relancer la commande ne casse rien. Options :
 *   --yes               accepte toutes les valeurs par défaut (non interactif)
 *   --brand "Nom"       nom de marque
 *   --url https://...   adresse publique (APP_URL)
 *   --email vous@ex.fr  email de l'administrateur
 *   --db postgres://... URL de la base
 *   --no-seed           n'insère pas les données de démonstration
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const opt = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const AUTO = has("--yes") || has("-y");

const rl = AUTO ? null : createInterface({ input: stdin, output: stdout });
async function ask(question: string, fallback: string): Promise<string> {
  if (!rl) return fallback;
  const a = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ""} : `)).trim();
  return a || fallback;
}
async function confirm(question: string, def = true): Promise<boolean> {
  if (AUTO) return def;
  const a = (await ask(`${question} (${def ? "O/n" : "o/N"})`, "")).toLowerCase();
  if (!a) return def;
  return a.startsWith("o") || a.startsWith("y");
}

const log = (s = "") => console.log(s);
const step = (s: string) => console.log(`\n\x1b[1m▶ ${s}\x1b[0m`);
const ok = (s: string) => console.log(`  \x1b[32m✓\x1b[0m ${s}`);
const warn = (s: string) => console.log(`  \x1b[33m!\x1b[0m ${s}`);

function run(cmd: string, cmdArgs: string[], env?: Record<string, string>): boolean {
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", env: { ...process.env, ...env } });
  return r.status === 0;
}

/** Lit la valeur d'une clé dans le contenu d'un .env. */
function getEnv(content: string, key: string): string {
  const m = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

/**
 * Écrit une valeur dans le contenu d'un .env.
 * - force=false (secrets) : n'écrit que si la clé est absente ou vide (ne jamais écraser).
 * - force=true (réponses de l'assistant) : remplace toujours, y compris les valeurs d'exemple.
 */
function setEnv(content: string, key: string, value: string, { force = false } = {}): string {
  const re = new RegExp(`^(${key})=(.*)$`, "m");
  const m = content.match(re);
  if (!m) return `${content}${content.endsWith("\n") ? "" : "\n"}${key}=${value}\n`;
  if (!force && m[2].trim()) return content;
  // Remplace la ligne sans interpréter les $ du remplacement (mots de passe, base64).
  return content.replace(re, () => `${key}=${value}`);
}

async function testDb(url: string): Promise<boolean> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 4000 });
  try {
    await pool.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

/** Tente de créer le rôle et la base en local (best-effort, via l'utilisateur postgres). */
function tryCreateLocalDb(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const dbName = u.pathname.replace(/^\//, "");
  const user = decodeURIComponent(u.username) || "cartes";
  const pass = decodeURIComponent(u.password) || "cartes";
  if (!["localhost", "127.0.0.1"].includes(u.hostname)) {
    warn("Base distante : créez-la chez votre hébergeur, puis relancez.");
    return false;
  }
  const psql = (sql: string) => spawnSync("sudo", ["-n", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=0", "-c", sql], { stdio: "pipe" }).status === 0;
  const createdb = () => spawnSync("sudo", ["-n", "-u", "postgres", "createdb", "-O", user, dbName], { stdio: "pipe" }).status === 0;
  const roleOk = psql(`DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${user}') THEN CREATE ROLE "${user}" LOGIN PASSWORD '${pass}' CREATEDB; END IF; END $$;`);
  const dbOk = createdb();
  return roleOk || dbOk;
}

async function main() {
  log("\n\x1b[1mInstallation de MaCartePro\x1b[0m");
  log("Cette commande prépare tout le nécessaire. Appuyez sur Entrée pour accepter les valeurs proposées.\n");

  // Les valeurs par défaut proposées reprennent un .env existant s'il y en a un, sinon des
  // valeurs locales raisonnables (jamais les lignes d'exemple comme « cartes_dev »).
  const envExists = existsSync(".env");
  const existing = envExists ? readFileSync(".env", "utf8") : "";
  const defBrand = getEnv(existing, "NEXT_PUBLIC_BRAND_NAME") || "MaCartePro";
  const defUrl = getEnv(existing, "APP_URL") || "http://localhost:3000";
  const defSupport = getEnv(existing, "SUPPORT_EMAIL") || "";
  const defDb = getEnv(existing, "DATABASE_URL") || "postgres://cartes:cartes@localhost:5432/macartepro";

  // 1. Réponses
  step("Configuration");
  const brand = opt("--brand") ?? (await ask("Nom de la marque", defBrand));
  const url = opt("--url") ?? (await ask("Adresse publique (laisser le défaut en local)", defUrl));
  const support = await ask("Email d'assistance", defSupport || `support@${safeDomain(url)}`);
  const dbUrl = opt("--db") ?? (await ask("Base de données (URL PostgreSQL)", defDb));
  const adminEmail = opt("--email") ?? (await ask("Email de l'administrateur (facultatif, Entrée pour passer)", ""));

  // 2. Fichier .env : secrets générés seulement s'ils manquent, réponses toujours écrites.
  step("Fichier .env");
  let env = envExists ? existing : readFileSync(".env.example", "utf8");
  env = setEnv(env, "BETTER_AUTH_SECRET", randomBytes(48).toString("base64"));
  env = setEnv(env, "BACKUP_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
  env = setEnv(env, "NEXT_PUBLIC_BRAND_NAME", brand, { force: true });
  env = setEnv(env, "APP_URL", url, { force: true });
  env = setEnv(env, "SUPPORT_EMAIL", support, { force: true });
  env = setEnv(env, "DATABASE_URL", dbUrl, { force: true });
  writeFileSync(".env", env);
  ok(envExists ? ".env mis à jour (secrets conservés, configuration appliquée)." : ".env créé avec des secrets générés.");
  warn("Conservez une copie de BACKUP_ENCRYPTION_KEY hors du serveur : sans elle, les sauvegardes chiffrées sont illisibles.");

  // 3. Base de données
  step("Base de données");
  if (await testDb(dbUrl)) {
    ok("Connexion à la base réussie.");
  } else if (await confirm("Base inaccessible. Tenter de la créer en local ?", true)) {
    if (tryCreateLocalDb(dbUrl) && (await testDb(dbUrl))) ok("Base créée.");
    else {
      warn("Création automatique impossible. Créez la base à la main puis relancez :");
      log(`    sudo -u postgres psql -c "CREATE USER cartes WITH PASSWORD 'cartes' CREATEDB;"`);
      log(`    sudo -u postgres createdb -O cartes ${new URL(dbUrl).pathname.replace(/^\//, "")}`);
      process.exitCode = 1;
      return;
    }
  } else {
    warn("Étape ignorée.");
    return;
  }

  // La base validée ci-dessus fait foi pour toutes les commandes suivantes, quelle que soit
  // la valeur chargée depuis .env.
  const childEnv = { DATABASE_URL: dbUrl };

  // 4. Migrations + données de départ (scripts déjà testés)
  step("Migrations");
  if (!run("npm", ["run", "db:migrate"], childEnv)) { warn("Échec des migrations."); process.exitCode = 1; return; }
  ok("Schéma à jour.");

  if (!has("--no-seed") && (await confirm("Insérer les formules et une organisation de démonstration ?", true))) {
    step("Données de départ");
    run("npm", ["run", "db:seed"], childEnv);
  }

  // 5. Administrateur
  if (adminEmail) {
    step("Administrateur");
    const created = run("npm", ["run", "admin:create", "--", "--email", adminEmail], childEnv);
    if (!created) warn(`Le compte ${adminEmail} doit d'abord être inscrit et vérifié. Inscrivez-vous puis lancez : npm run admin:create -- --email ${adminEmail}`);
  }

  // 6. Vérification + résumé
  step("Vérification");
  run("npm", ["run", "doctor"], childEnv);

  log("\n\x1b[1m✅ Installation terminée.\x1b[0m");
  log("Prochaines étapes :");
  log("  1. npm run dev        (développement)  ou  npm run build && npm start  (production)");
  if (!adminEmail) log("  2. Inscrivez-vous, puis : npm run admin:create -- --email vous@exemple.fr");
  log("  3. Dans /admin/reglages : société, domaine et validations juridiques.");
  log("  4. Dans /admin/plans : « Créer les prix dans Stripe » une fois STRIPE_SECRET_KEY renseignée.");
  log("");
}

function safeDomain(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "") || "exemple.fr";
  } catch {
    return "exemple.fr";
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => rl?.close());
