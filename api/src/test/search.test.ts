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

type S = { cookie: string; email: string; companyId?: string };
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
  const email = `search-${label}-${run}-${n++}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: label, password: "motdepasse-ok" }) });
  return { cookie: reg.headers.getSetCookie()[0].split(";")[0], email };
}
const find = async (s: S, q: string) => (await http(s, "GET", `/search?q=${encodeURIComponent(q)}`)).json() as { leads: { name: string }[]; contacts: { name: string }[]; tasks: { title: string }[] };

describe("recherche globale", () => {
  it("trouve leads, contacts et tâches, ignore la corbeille et les jokers", async () => {
    const s = await register("ceo");
    s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
    const lead = (await http(s, "POST", "/leads", { name: "Boulangerie Soleil", contactName: "Soleil Awa" })).json();
    const gone = (await http(s, "POST", "/leads", { name: "Soleil Pharmacie" })).json();
    await http(s, "POST", "/tasks", { title: "Appeler Soleil", leadId: lead.id });
    await http(s, "DELETE", `/leads/${gone.id}`);

    const r = await find(s, "soleil");
    expect(r.leads.map((l) => l.name)).toEqual(["Boulangerie Soleil"]);
    expect(r.contacts.map((c) => c.name)).toEqual(["Soleil Awa"]);
    expect(r.tasks.map((t) => t.title)).toEqual(["Appeler Soleil"]);
    const wild = await find(s, "%%");
    expect(wild.leads).toHaveLength(0); // le joker n'est pas interprété
    expect((await http(s, "GET", "/search?q=a")).status).toBe(400); // trop court
  });

  it("ne montre que ce que la personne a le droit de lire", async () => {
    const ceo = await register("ceo");
    ceo.companyId = (await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
    await http(ceo, "POST", "/leads", { name: "Secret du CEO" });
    const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: { key: string; id: string }) => [r.key, r.id]));
    const pro = await register("pro");
    pro.companyId = ceo.companyId;
    await http(ceo, "POST", "/members", { email: pro.email, roleIds: [roles.prospecteur] });
    await http(pro, "POST", "/leads", { name: "Mon lead secret" });
    const r = await find(pro, "secret");
    expect(r.leads.map((l) => l.name)).toEqual(["Mon lead secret"]);
  });
});
