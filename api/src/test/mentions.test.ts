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
  const email = `men-${label}-${run}-${n++}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: label, password: "motdepasse-ok" }) });
  const s: S = { cookie: reg.headers.getSetCookie()[0].split(";")[0], email };
  s.id = (await http(s, "GET", "/me")).json().user.id;
  return s;
}

describe("commentaires avec mentions", () => {
  it("mentionner un collègue qui peut lire le lead le notifie et garde la mention dans le fil", async () => {
    const ceo = await register("ceo");
    ceo.companyId = (await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
    const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: { key: string; id: string }) => [r.key, r.id]));
    const manager = await register("manager");
    manager.companyId = ceo.companyId;
    await http(ceo, "POST", "/members", { email: manager.email, roleIds: [roles.manager] });
    const lead = (await http(ceo, "POST", "/leads", { name: "Boulangerie" })).json();

    const choices = (await http(ceo, "GET", `/leads/${lead.id}/mentionable`)).json();
    expect(choices.map((c: { id: string }) => c.id)).toEqual([manager.id]); // pas soi-même

    const note = await http(ceo, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: "@manager peux-tu rappeler ?", mentions: [manager.id] });
    expect(note.status).toBe(201);
    expect(note.json().meta).toEqual({ mentions: [{ id: manager.id, name: "manager" }] });
    const inbox = (await http(manager, "GET", "/notifications")).json().items as { kind: string; title: string }[];
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ kind: "mention", title: "ceo vous a mentionné : Boulangerie" });
  });

  it("refuse de mentionner soi-même, un inconnu ou quelqu'un qui ne peut pas lire le lead", async () => {
    const ceo = await register("ceo");
    ceo.companyId = (await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
    const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: { key: string; id: string }) => [r.key, r.id]));
    const pro = await register("pro");
    pro.companyId = ceo.companyId;
    await http(ceo, "POST", "/members", { email: pro.email, roleIds: [roles.prospecteur] }); // ne lit que ses propres leads
    const lead = (await http(ceo, "POST", "/leads", { name: "Lead du CEO" })).json();
    const note = (mentions: string[]) => http(ceo, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: "x", mentions });
    expect((await note([pro.id!])).status).toBe(400);
    expect((await note([ceo.id!])).status).toBe(400);
    expect((await note(["00000000-0000-0000-0000-000000000000"])).status).toBe(400);
    expect((await http(pro, "GET", "/notifications")).json().items).toHaveLength(0);
  });
});
