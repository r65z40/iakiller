import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { __pgPool?: Pool; __db?: DB };

/** Adresse de la base (valeur de développement par défaut). */
export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? "postgres://cartes:cartes@localhost:5432/cartes_dev";
}

function createPool(): Pool {
  return new Pool({
    connectionString: databaseUrl(),
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });
}

export const pool: Pool = globalForDb.__pgPool ?? createPool();
export const db: DB = globalForDb.__db ?? drizzle(pool, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgPool = pool;
  globalForDb.__db = db;
}

export { schema };
