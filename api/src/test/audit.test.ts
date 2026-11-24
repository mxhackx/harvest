import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { client } from "../db/index.js";
import { shouldAudit } from "../audit/record.js";

let app: FastifyInstance;
let base = "";
beforeAll(async () => {
  app = await buildApp({ logger: false });
  base = await app.listen({ port: 0, host: "127.0.0.1" });
});
afterAll(async () => {
  await app.close();
  await client.end();
});

type S = { cookie: string; companyId?: string };
const run = Math.random().toString(36).slice(2, 8);
let n = 0;
async function http(s: S, method: string, url: string, body?: unknown) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), cookie: s.cookie, ...(s.companyId ? { "x-company-id": s.companyId } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: () => (text ? JSON.parse(text) : null) };
}
async function register(): Promise<S> {
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `audit-${run}-${n++}@test.dev`, name: "Awa CEO", password: "motdepasse-ok" }) });
  return { cookie: reg.headers.getSetCookie()[0].split(";")[0] };
}
type Entry = { action: string; entityLabel: string; actorName: string };
/** Le journal s'écrit juste après la réponse : on attend qu'il ait le nombre de lignes voulu. */
async function journal(s: S, expected: number): Promise<Entry[]> {
  for (let i = 0; i < 40; i++) {
    const items = (await http(s, "GET", "/audit")).json().items as Entry[];
    if (items.length >= expected) return items;
    await new Promise((r) => setTimeout(r, 50));
  }
  return (await http(s, "GET", "/audit")).json().items;
}

describe("shouldAudit", () => {
  it("journalise une modification réussie, pas une lecture, un échec ni une analyse à blanc", () => {
    expect(shouldAudit("DELETE", "/leads/:id", 204, undefined)).toBe(true);
    expect(shouldAudit("GET", "/leads", 200, undefined)).toBe(false);
    expect(shouldAudit("POST", "/leads", 400, {})).toBe(false);
    expect(shouldAudit("POST", "/leads/import", 200, { dryRun: true })).toBe(false);
    expect(shouldAudit("POST", "/leads/import", 200, { dryRun: false })).toBe(true);
    expect(shouldAudit("POST", "/notifications/read", 204, {})).toBe(false);
  });
});

describe("journal d'audit", () => {
  it("garde qui a fait quoi, avec le nom du lead même une fois supprimé, et seul le CEO le lit", async () => {
    const ceo = await register();
    ceo.companyId = (await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
    const lead = (await http(ceo, "POST", "/leads", { name: "Boulangerie" })).json();
    await http(ceo, "PATCH", `/leads/${lead.id}`, { city: "Cotonou" });
    await http(ceo, "DELETE", `/leads/${lead.id}`);
    await http(ceo, "POST", "/leads", { name: "" }); // refusé : pas dans le journal
    await http(ceo, "POST", "/leads/import", { content: "name\nX", format: "csv" }); // analyse à blanc : pas dans le journal

    const items = await journal(ceo, 3);
    expect(items.map((i) => i.action)).toEqual(["DELETE /leads/:id", "PATCH /leads/:id", "POST /leads"]); // du plus récent au plus ancien
    expect(items[0]).toMatchObject({ entityLabel: "Boulangerie", actorName: "Awa CEO" });

    // un manager n'a pas le droit de lire le journal
    const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: { key: string; id: string }) => [r.key, r.id]));
    const email = `audit-mgr-${run}@test.dev`;
    const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: "M", password: "motdepasse-ok" }) });
    const mgr: S = { cookie: reg.headers.getSetCookie()[0].split(";")[0], companyId: ceo.companyId };
    expect((await http(ceo, "POST", "/members", { email, roleIds: [roles.manager] })).status).toBe(201);
    expect((await http(mgr, "GET", "/audit")).status).toBe(403);
  });

  it("pagine avec before", async () => {
    const ceo = await register();
    ceo.companyId = (await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
    for (const name of ["A", "B", "C"]) await http(ceo, "POST", "/leads", { name });
    await journal(ceo, 3);
    const first = (await http(ceo, "GET", "/audit?limit=2")).json();
    expect(first.items).toHaveLength(2);
    expect(first.next).not.toBeNull();
    const second = (await http(ceo, "GET", `/audit?limit=2&before=${encodeURIComponent(first.next)}`)).json();
    expect(second.items.map((i: Entry) => i.entityLabel)).toEqual(["A"]);
    expect(second.next).toBeNull();
  });
});
