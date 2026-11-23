import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import * as schema from "./schema.js";

// Le pooler Supabase en mode transaction (port 6543) ne supporte pas les requêtes préparées.
const viaTransactionPooler = /:6543\//.test(config.databaseUrl);

export const client = postgres(config.databaseUrl, {
  prepare: !viaTransactionPooler,
});
export const db = drizzle(client, { schema });
export type Db = typeof db;
