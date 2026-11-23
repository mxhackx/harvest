// Applique les migrations Drizzle puis s'arrête. Lancé avant le serveur au déploiement (npm run start:prod).
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "./config.js";
import { connectionOptions, isTransactionPooler } from "./db/connection.js";

if (!config.databaseUrl) {
  console.error("DATABASE_URL n'est pas défini.");
  process.exit(1);
}
if (isTransactionPooler(config.databaseUrl)) {
  console.error(
    "Les migrations demandent une connexion en mode session : utilisez le « Session pooler » de Supabase (port 5432), pas le pooler en mode transaction (port 6543).",
  );
  process.exit(1);
}

// une seule connexion : le verrou et les migrations partagent la même session
const sql = postgres(config.databaseUrl, { ...connectionOptions(config.databaseUrl), max: 1 });
const LOCK = 727274; // si plusieurs instances démarrent ensemble, une seule migre à la fois

try {
  await sql`select pg_advisory_lock(${LOCK})`;
  await migrate(drizzle(sql), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  console.log("Migrations appliquées.");
} catch (e) {
  console.error("Échec des migrations :", e);
  process.exitCode = 1;
} finally {
  await sql`select pg_advisory_unlock(${LOCK})`.catch(() => undefined);
  await sql.end();
}
