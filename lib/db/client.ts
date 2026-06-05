import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Serverless-safe Postgres client for Supabase.
 *
 * Use the POOLED connection string (PgBouncer, port 6543, transaction mode)
 * in DATABASE_URL. Prepared statements MUST be disabled for transaction-mode
 * pooling, otherwise queries fail under concurrency.
 */
type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  _pgClient?: ReturnType<typeof postgres>;
  _drizzleDb?: Db;
};

function getClient() {
  if (globalForDb._pgClient) return globalForDb._pgClient;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, {
    prepare: false, // required for PgBouncer transaction mode
    max: 1, // one connection per serverless instance; pooler fans out
    idle_timeout: 20,
    connect_timeout: 15,
  });
  if (process.env.NODE_ENV !== "production") globalForDb._pgClient = client;
  return client;
}

export function getDb(): Db {
  if (globalForDb._drizzleDb) return globalForDb._drizzleDb;
  const dbInstance = drizzle(getClient(), { schema });
  if (process.env.NODE_ENV !== "production") globalForDb._drizzleDb = dbInstance;
  return dbInstance;
}

/** Lazy proxy: no DB connection is opened until a query is actually issued. */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const realDb = getDb();
    const value = (realDb as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(realDb) : value;
  },
});

export { schema };
