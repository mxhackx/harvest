import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export default async function setup() {
  const url = process.env.DATABASE_URL ?? "postgres://harvest:harvest@localhost:54329/harvest_test";
  const c = postgres(url, { max: 1 });
  await migrate(drizzle(c), { migrationsFolder: "./drizzle" });
  await c.end();
}
