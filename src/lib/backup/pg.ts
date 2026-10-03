import { spawn } from "node:child_process";

/**
 * Appels à pg_dump / pg_restore (paquet postgresql-client, même version majeure que le
 * serveur ou plus récente). Le mot de passe passe par PGPASSWORD et non par la ligne de
 * commande, pour ne pas apparaître dans la liste des processus.
 */
function connection(url: string) {
  const u = new URL(url);
  const password = decodeURIComponent(u.password);
  u.password = "";
  return { dbname: u.toString(), env: { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: "15" } };
}

function run(bin: string, args: string[], env: NodeJS.ProcessEnv, input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.stderr.on("data", (c: Buffer) => (err += c.toString()).length > 8000 && (err = err.slice(-8000)));
    child.on("error", (e: NodeJS.ErrnoException) =>
      reject(e.code === "ENOENT" ? new Error(`${bin} introuvable : installez le client PostgreSQL (postgresql-client, même version majeure que le serveur).`) : e),
    );
    child.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`${bin} a échoué (code ${code}) : ${err.trim().slice(-1500)}`))));
    child.stdin.on("error", () => undefined);
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

const pgDumpBin = () => process.env.PG_DUMP_PATH || "pg_dump";
const pgRestoreBin = () => process.env.PG_RESTORE_PATH || "pg_restore";

/** Export complet, format « custom » compressé (restaurable table par table). */
export async function pgDump(databaseUrl: string, snapshot?: string): Promise<Buffer> {
  const c = connection(databaseUrl);
  const args = ["--format=custom", "--compress=6", "--no-owner", "--no-privileges", `--dbname=${c.dbname}`];
  if (snapshot) args.push(`--snapshot=${snapshot}`);
  return run(pgDumpBin(), args, c.env);
}

/** Lecture de la table des matières : prouve que l'export est lisible par pg_restore. */
export async function pgRestoreList(dump: Buffer): Promise<number> {
  const out = await run(pgRestoreBin(), ["--list"], process.env, dump);
  return out.toString().split("\n").filter((l) => l && !l.startsWith(";")).length;
}

/** Restauration dans une base CIBLE (objets existants remplacés). */
export async function pgRestore(dump: Buffer, targetUrl: string): Promise<void> {
  const c = connection(targetUrl);
  await run(pgRestoreBin(), ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--single-transaction", `--dbname=${c.dbname}`], c.env, dump);
}

export async function pgToolsVersion(): Promise<string | null> {
  try {
    return (await run(pgDumpBin(), ["--version"], process.env)).toString().trim();
  } catch {
    return null;
  }
}

/** Compare deux URL de base sans tenir compte des identifiants. */
export function sameDatabase(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    const host = (u: URL) => (u.hostname === "127.0.0.1" ? "localhost" : u.hostname);
    return host(x) === host(y) && (x.port || "5432") === (y.port || "5432") && x.pathname === y.pathname;
  } catch {
    return a === b;
  }
}
