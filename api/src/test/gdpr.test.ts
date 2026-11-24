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
  return { status: res.status, headers: res.headers, json: () => (text ? JSON.parse(text) : null) };
}
async function register(label: string): Promise<S & { email: string }> {
  const email = `gdpr-${label}-${run}-${n++}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: label, password: "motdepasse-ok" }) });
  return { cookie: reg.headers.getSetCookie()[0].split(";")[0], email };
}

describe("RGPD : export et effacement d'un contact", () => {
  it("l'export donne les données de la personne ; l'effacement exige une confirmation, retire la personne et son nom du lead", async () => {
    const ceo = await register("ceo");
    ceo.companyId = (await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
    const lead = (await http(ceo, "POST", "/leads", { name: "Boulangerie", contactName: "Awa Dossou" })).json();
    const [contact] = (await http(ceo, "GET", `/leads/${lead.id}/contacts`)).json();
    await http(ceo, "PATCH", `/contacts/${contact.id}`, { email: "awa@example.com", phone: "+229 97 00 11 22" });

    const exported = await http(ceo, "GET", `/contacts/${contact.id}/export`);
    expect(exported.status).toBe(200);
    expect(exported.headers.get("content-disposition")).toContain("attachment");
    expect(exported.json()).toMatchObject({ contact: { name: "Awa Dossou", email: "awa@example.com", phone: "+229 97 00 11 22" }, lead: { name: "Boulangerie" } });

    expect((await http(ceo, "POST", `/contacts/${contact.id}/erase`, {})).status).toBe(400); // sans confirmation
    expect((await http(ceo, "POST", `/contacts/${contact.id}/erase`, { confirm: true })).status).toBe(204);
    expect((await http(ceo, "GET", `/leads/${lead.id}/contacts`)).json()).toHaveLength(0);
    expect((await http(ceo, "GET", "/leads")).json()[0].contactName).toBe("");
    expect((await http(ceo, "GET", `/contacts/${contact.id}/export`)).status).toBe(404);
  });

  it("sans les droits d'export et de suppression, rien n'est possible", async () => {
    const ceo = await register("ceo");
    ceo.companyId = (await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
    const lead = (await http(ceo, "POST", "/leads", { name: "L", contactName: "Personne" })).json();
    const [contact] = (await http(ceo, "GET", `/leads/${lead.id}/contacts`)).json();
    const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: { key: string; id: string }) => [r.key, r.id]));
    const pro = await register("pro");
    pro.companyId = ceo.companyId;
    expect((await http(ceo, "POST", "/members", { email: pro.email, roleIds: [roles.prospecteur] })).status).toBe(201);
    expect((await http(pro, "GET", `/contacts/${contact.id}/export`)).status).toBe(403);
    expect((await http(pro, "POST", `/contacts/${contact.id}/erase`, { confirm: true })).status).toBe(403);
  });
});
