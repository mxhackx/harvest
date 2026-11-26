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
async function ceo(): Promise<S> {
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `wf-${run}-${n++}@test.dev`, name: "ceo", password: "motdepasse-ok" }) });
  const s: S = { cookie: reg.headers.getSetCookie()[0].split(";")[0] };
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}

const at = { position: { x: 0, y: 0 } };
const start = { id: "start", type: "start", label: "Start", ...at, config: { trigger: "manual" } };
const task = (id: string) => ({ id, type: "task", label: id, ...at, config: { title: "Relancer", afterDays: 1 } });

describe("workflows", () => {
  it("enregistre une chaîne et la garde dans son entreprise", async () => {
    const a = await ceo();
    const w = (await http(a, "POST", "/workflows", { name: "Relance" })).json();
    expect(w.graph.nodes).toHaveLength(1);
    const graph = { nodes: [start, task("a")], edges: [{ source: "start", target: "a" }] };
    expect((await http(a, "PATCH", `/workflows/${w.id}`, { graph })).status).toBe(200);
    expect((await http(a, "GET", `/workflows/${w.id}`)).json().graph.edges).toHaveLength(1);
    const b = await ceo();
    expect((await http(b, "GET", `/workflows/${w.id}`)).status).toBe(404);
    expect((await http(b, "GET", "/workflows")).json()).toEqual([]);
  });

  it("refuse les branches, les boucles et une autonomie au-delà du plafond", async () => {
    const s = await ceo();
    const post = async (graph: unknown) => (await http(s, "POST", "/workflows", { name: "x", graph })).status;
    expect(await post({ nodes: [start, task("a"), task("b")], edges: [{ source: "start", target: "a" }, { source: "start", target: "b" }] })).toBe(400);
    expect(await post({ nodes: [start, task("a"), task("b")], edges: [{ source: "a", target: "b" }, { source: "b", target: "a" }] })).toBe(400);
    const agent = (autonomy: number) => ({ id: "m", type: "agent", label: "Message", ...at, config: { action: "envoyer_message", autonomy } });
    expect(await post({ nodes: [start, agent(3)], edges: [] })).toBe(400);
    expect(await post({ nodes: [start, agent(2)], edges: [] })).toBe(201);
  });
});
