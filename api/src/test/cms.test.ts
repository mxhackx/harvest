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

const run = Math.random().toString(36).slice(2, 8);
let n = 0;
async function http(cookie: string, method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + url, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), cookie, ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, json: () => (text ? JSON.parse(text) : null) };
}
async function register() {
  const res = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `cms-${run}-${n++}@test.dev`, name: "c", password: "motdepasse-ok" }) });
  return res.headers.getSetCookie()[0].split(";")[0];
}
const root = (children: unknown[] = []) => ({ id: "r", type: "frame", name: "Page", props: {}, children });
const data = (children: unknown[] = []) => ({ name: "Café", variables: [], styles: [], pages: [{ id: "p", name: "Accueil", path: "", root: root(children) }] });

describe("CMS", () => {
  it("demande un espace Sites, sans entreprise, et n'écrase pas un travail plus récent", async () => {
    const me = await register();
    expect((await http("", "GET", "/cms/sites")).status).toBe(401);
    expect((await http(me, "GET", "/cms/sites")).status).toBe(403);
    expect((await http(me, "POST", "/cms/account", {})).status).toBe(201);
    const site = (await http(me, "POST", "/cms/sites", { data: data() })).json();
    expect((await http(me, "PUT", `/cms/sites/${site.id}`, { data: data(), version: 1 })).json().version).toBe(2);
    expect((await http(me, "PUT", `/cms/sites/${site.id}`, { data: data(), version: 1 })).status).toBe(409);
  });

  it("refuse ce qui n'est pas un site (script, image distante, champ inconnu)", async () => {
    const me = await register();
    await http(me, "POST", "/cms/account", {});
    for (const bad of [
      { id: "x", type: "script", name: "s", props: {} },
      { id: "x", type: "image", name: "i", props: {}, src: "https://pirate.test/p.png" },
      { id: "x", type: "text", name: "t", props: {}, onclick: "alert(1)" },
    ])
      expect((await http(me, "POST", "/cms/sites", { data: data([bad]) })).status, JSON.stringify(bad)).toBe(400);
  });

  it("une écriture venant d'une origine inconnue est refusée", async () => {
    const me = await register();
    const from = (origin: string) => http(me, "POST", "/cms/account", {}, { origin });
    expect((await from("https://client.sites.hivation.tech")).status).toBe(403);
    expect((await from("http://localhost:3000")).status).toBe(201);
  });
});
