import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/** Applique les migrations versionnées du dossier ./drizzle. */
async function main() {
  const url = process.env.DATABASE_URL ?? "postgres://cartes:cartes@localhost:5432/cartes_dev";
  const pool = new Pool({ connectionString: url, max: 1 });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("Migrations appliquées.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
