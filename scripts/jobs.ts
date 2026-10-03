/**
 * Tâches planifiées. Usage :
 *   npm run jobs            # exécution unique (cron toutes les 15 min)
 *   npm run jobs -- --watch # boucle continue (une exécution toutes les 15 min)
 */
import { runAllJobs } from "../src/lib/jobs";
import { pool } from "../src/lib/db";

async function once() {
  const results = await runAllJobs();
  console.log(new Date().toISOString(), JSON.stringify(results));
}

async function main() {
  if (process.argv.includes("--watch")) {
    for (;;) {
      await once().catch((e) => console.error(e));
      await new Promise((r) => setTimeout(r, 15 * 60_000));
    }
  }
  await once();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
