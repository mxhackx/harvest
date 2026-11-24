import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { client } from "../db/index.js";

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

type S = { cookie: string; email: string; companyId?: string; id?: string };
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
async function register(label: string): Promise<S> {
  const email = `obj-${label}-${run}-${n++}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: label, password: "motdepasse-ok" }) });
  return { cookie: reg.headers.getSetCookie()[0].split(";")[0], email };
}
const thisMonth = new Date().toISOString().slice(0, 7);

describe("objectifs par commercial", () => {
  it("compare les objectifs du mois au réel (visites, leads gagnés, valeur) et chacun voit les siens", async () => {
    const ceo = await register("ceo");
    ceo.companyId = (await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
    const me = (await http(ceo, "GET", "/me")).json().user.id as string;
    const won = ((await http(ceo, "GET", "/stages")).json() as { key: string; kind: string }[]).find((s) => s.kind === "won")!.key;
    const a = (await http(ceo, "POST", "/leads", { name: "Gagné", estimatedValue: 50_000 })).json();
    const b = (await http(ceo, "POST", "/leads", { name: "Visité" })).json();
    await http(ceo, "PATCH", `/leads/${a.id}`, { visited: true, status: won });
    await http(ceo, "PATCH", `/leads/${b.id}`, { visited: true });

    expect((await http(ceo, "PUT", "/objectives", { userId: me, month: thisMonth, targetVisits: 4, targetWon: 2, targetValue: 100_000 })).status).toBe(204);
    const [row] = (await http(ceo, "GET", `/objectives?month=${thisMonth}`)).json().items;
    expect(row).toMatchObject({ userId: me, target: { visits: 4, won: 2, value: 100_000 }, done: { visits: 2, won: 1, value: 50_000 }, percent: { visits: 50, won: 50, value: 50 } });

    // le prospecteur ne voit que lui-même, et ne peut pas fixer d'objectifs
    const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: { key: string; id: string }) => [r.key, r.id]));
    const pro = await register("pro");
    pro.companyId = ceo.companyId;
    await http(ceo, "POST", "/members", { email: pro.email, roleIds: [roles.prospecteur] });
    const mine = (await http(pro, "GET", `/objectives?month=${thisMonth}`)).json().items as { name: string }[];
    expect(mine.map((i) => i.name)).toEqual(["pro"]);
    expect((await http(pro, "PUT", "/objectives", { userId: me, month: thisMonth, targetVisits: 1, targetWon: 1, targetValue: 1 })).status).toBe(403);
  });

  it("refuse un mois invalide ou une personne d'une autre entreprise, et remplace l'objectif existant", async () => {
    const ceo = await register("ceo");
    ceo.companyId = (await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
    const me = (await http(ceo, "GET", "/me")).json().user.id as string;
    const other = await register("other");
    const otherId = (await http(other, "GET", "/me")).json().user.id as string;
    expect((await http(ceo, "GET", "/objectives?month=novembre")).status).toBe(400);
    expect((await http(ceo, "PUT", "/objectives", { userId: me, month: "2026-13", targetVisits: 1, targetWon: 0, targetValue: 0 })).status).toBe(400);
    expect((await http(ceo, "PUT", "/objectives", { userId: otherId, month: thisMonth, targetVisits: 1, targetWon: 0, targetValue: 0 })).status).toBe(400);
    await http(ceo, "PUT", "/objectives", { userId: me, month: thisMonth, targetVisits: 5, targetWon: 0, targetValue: 0 });
    await http(ceo, "PUT", "/objectives", { userId: me, month: thisMonth, targetVisits: 9, targetWon: 0, targetValue: 0 });
    expect((await http(ceo, "GET", `/objectives?month=${thisMonth}`)).json().items[0].target.visits).toBe(9);
  });
});
