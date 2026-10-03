/**
 * Sauvegardes en ligne de commande. Fonctionne même si la base d'origine est perdue :
 * la liste et la restauration ne lisent que la destination de sauvegarde.
 *
 *   npm run backup -- run [--full]                 sauvegarde immédiate (--full : recopie tous les fichiers)
 *   npm run backup -- list                         sauvegardes présentes dans la destination
 *   npm run backup -- verify <id|latest>           vérification complète (empreintes, lisibilité)
 *   npm run backup -- restore <id|latest> --target-db <url> [--media] [--replace-current]
 *   npm run backup -- restore-test <id|latest>     restauration d'essai dans BACKUP_RESTORE_TEST_DATABASE_URL
 */
import { pool } from "../src/lib/db";
import { backupDestination } from "../src/lib/backup/destination";
import { readIndex, readManifest, restoreBackup, restoreTest, runBackup, verifyBackup } from "../src/lib/backup/service";
import { storage } from "../src/lib/media/storage";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} Mo`;

async function resolveId(raw: string | undefined): Promise<string> {
  const dest = backupDestination();
  if (!dest) throw new Error("Aucune destination de sauvegarde (BACKUP_DRIVER).");
  if (!raw) throw new Error("Identifiant de sauvegarde attendu (ou « latest »).");
  if (raw !== "latest") return raw;
  const [first] = await readIndex(dest.store);
  if (!first) throw new Error("Aucune sauvegarde dans la destination.");
  return first.id;
}

async function main() {
  const [command, arg] = args;
  switch (command) {
    case "run": {
      const row = await runBackup({ trigger: "cli", full: flag("--full") });
      if (row.status !== "ok") throw new Error(`Échec : ${row.error}`);
      console.log(`Sauvegarde ${row.id} réussie : base ${mb(row.dbBytes)}, ${row.mediaCount} fichier(s) dont ${row.mediaCopied} copié(s), ${mb(row.writtenBytes)} écrits.`);
      if (row.missingFiles) console.warn(`Attention : ${row.missingFiles} fichier(s) de média actif(s) introuvable(s) dans le stockage.`);
      break;
    }
    case "list": {
      const dest = backupDestination();
      if (!dest) throw new Error("Aucune destination de sauvegarde (BACKUP_DRIVER).");
      console.log(`Destination : ${dest.label}`);
      for (const e of await readIndex(dest.store)) {
        const m = await readManifest(dest.store, e.id).catch(() => null);
        console.log(`${e.id}  ${e.startedAt}  ${e.encrypted ? "chiffrée" : "en clair "}  ${m ? `base ${mb(m.database.bytes)}, ${m.media.length} fichier(s)` : "manifeste illisible"}`);
      }
      break;
    }
    case "verify": {
      const r = await verifyBackup(await resolveId(arg));
      console.log(r.ok ? `OK — ${r.detail}` : `ÉCHEC — ${r.detail}`);
      if (!r.ok) process.exitCode = 2;
      break;
    }
    case "restore": {
      const target = option("--target-db");
      if (!target) throw new Error("--target-db <url> est obligatoire (base cible, de préférence neuve).");
      const id = await resolveId(arg);
      const r = await restoreBackup({
        id,
        targetDatabaseUrl: target,
        mediaTarget: flag("--media") ? storage() : null,
        allowCurrentDatabase: flag("--replace-current"),
        onProgress: (m) => console.log(m),
      });
      console.log(`Restauration terminée. Comptages : ${Object.entries(r.counts).map(([t, n]) => `${t}=${n}`).join(", ")}.`);
      console.log(flag("--media") ? `${r.mediaRestored} fichier(s) restauré(s) dans le stockage configuré.` : "Fichiers non restaurés (ajoutez --media).");
      console.log("Étapes suivantes : npm run db:migrate sur la base cible, puis faire pointer DATABASE_URL dessus et redémarrer.");
      break;
    }
    case "restore-test": {
      const r = await restoreTest(await resolveId(arg));
      console.log(r.ok ? `OK — ${r.detail}` : `ÉCHEC — ${r.detail}`);
      if (!r.ok) process.exitCode = 2;
      break;
    }
    default:
      console.log("Commandes : run [--full] | list | verify <id|latest> | restore <id|latest> --target-db <url> [--media] [--replace-current] | restore-test <id|latest>");
      process.exitCode = command ? 1 : 0;
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => undefined));
