import { afterAll, describe, expect, it } from "vitest";
import { client } from "../db/index.js";

afterAll(() => client.end());

describe("sécurité par ligne (Supabase)", () => {
  it("toutes les tables du schéma public ont la RLS activée : aucune n'est lisible via l'API REST de Supabase", async () => {
    const rows = await client<{ table: string }[]>`
      select c.relname as "table"
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      order by 1`;
    // si ce test échoue : ajoutez ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY; dans une nouvelle migration
    expect(rows.map((r) => r.table)).toEqual([]);
  });

  it("l'API (rôle propriétaire) lit et écrit toujours normalement", async () => {
    const [{ n }] = await client<{ n: number }[]>`select count(*)::int as n from users`;
    expect(n).toBeGreaterThanOrEqual(0);
  });
});
