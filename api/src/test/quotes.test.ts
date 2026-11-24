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
  const email = `quo-${label}-${run}-${n++}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: label, password: "motdepasse-ok" }) });
  return { cookie: reg.headers.getSetCookie()[0].split(";")[0], email };
}
async function ceo(): Promise<S> {
  const s = await register("ceo");
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}
const LINES = [
  { label: "Site vitrine", quantity: 1, unitPrice: 250_000 },
  { label: "Formation (heures)", quantity: 2.5, unitPrice: 15_000 },
];

describe("devis", () => {
  it("numérote D-année-0001, calcule les totaux et suit brouillon → envoyé → accepté (qui fixe la valeur du lead)", async () => {
    const s = await ceo();
    const lead = (await http(s, "POST", "/leads", { name: "Boulangerie Soleil" })).json();
    const a = (await http(s, "POST", `/leads/${lead.id}/quotes`, { title: "Site vitrine", lines: LINES, taxRate: 18 })).json();
    const b = (await http(s, "POST", `/leads/${lead.id}/quotes`, { title: "Option" })).json();
    expect(a.number).toMatch(/^D-\d{4}-0001$/);
    expect(b.number).toMatch(/^D-\d{4}-0002$/);
    expect(a).toMatchObject({ status: "draft", subtotal: 287_500, tax: 51_750, total: 339_250 });

    expect((await http(s, "POST", `/quotes/${b.id}/status`, { status: "sent" })).status).toBe(409); // vide : rien à envoyer
    expect((await http(s, "POST", `/quotes/${a.id}/status`, { status: "accepted" })).status).toBe(409); // il faut l'envoyer d'abord
    expect((await http(s, "POST", `/quotes/${a.id}/status`, { status: "sent" })).json().status).toBe("sent");
    expect((await http(s, "PATCH", `/quotes/${a.id}`, { title: "Autre" })).status).toBe(409); // verrouillé après l'envoi
    expect((await http(s, "DELETE", `/quotes/${a.id}`)).status).toBe(409);

    const accepted = (await http(s, "POST", `/quotes/${a.id}/status`, { status: "accepted" })).json();
    expect(accepted.status).toBe("accepted");
    expect((await http(s, "GET", "/leads")).json()[0].estimatedValue).toBe(339_250);
    expect((await http(s, "POST", `/quotes/${a.id}/status`, { status: "declined" })).status).toBe(409); // décision finale
    const feed = JSON.stringify((await http(s, "GET", `/leads/${lead.id}/activities`)).json());
    expect(feed).toContain("envoyé");
    expect(feed).toContain("accepté");
    expect((await http(s, "GET", `/leads/${lead.id}/quotes`)).json()).toHaveLength(2);
  });

  it("un brouillon se modifie et se supprime ; les lignes invalides sont refusées", async () => {
    const s = await ceo();
    const lead = (await http(s, "POST", "/leads", { name: "Pharmacie" })).json();
    const q = (await http(s, "POST", `/leads/${lead.id}/quotes`, { title: "Brouillon", lines: LINES })).json();
    const patched = (await http(s, "PATCH", `/quotes/${q.id}`, { lines: [{ label: "Seule ligne", quantity: 3, unitPrice: 1000 }], taxRate: 0 })).json();
    expect(patched).toMatchObject({ subtotal: 3000, total: 3000 });
    expect((await http(s, "PATCH", `/quotes/${q.id}`, { lines: [{ label: "", quantity: 1, unitPrice: 1 }] })).status).toBe(400);
    expect((await http(s, "PATCH", `/quotes/${q.id}`, { lines: [{ label: "x", quantity: 0, unitPrice: 1 }] })).status).toBe(400);
    expect((await http(s, "PATCH", `/quotes/${q.id}`, { lines: [{ label: "x", quantity: 1.234, unitPrice: 1 }] })).status).toBe(400);
    expect((await http(s, "PATCH", `/quotes/${q.id}`, { taxRate: 150 })).status).toBe(400);
    expect((await http(s, "DELETE", `/quotes/${q.id}`)).status).toBe(204);
    expect((await http(s, "GET", `/quotes/${q.id}`)).status).toBe(404);
  });

  it("un devis suit les droits sur son lead : introuvable pour qui ne le lit pas", async () => {
    const s = await ceo();
    const lead = (await http(s, "POST", "/leads", { name: "Lead du CEO" })).json();
    const q = (await http(s, "POST", `/leads/${lead.id}/quotes`, { title: "Privé", lines: LINES })).json();
    const roles = Object.fromEntries((await http(s, "GET", "/roles")).json().map((r: { key: string; id: string }) => [r.key, r.id]));
    const pro = await register("pro");
    pro.companyId = s.companyId;
    await http(s, "POST", "/members", { email: pro.email, roleIds: [roles.prospecteur] });
    expect((await http(pro, "GET", `/quotes/${q.id}`)).status).toBe(404);
    expect((await http(pro, "GET", `/leads/${lead.id}/quotes`)).status).toBe(404);
    expect((await http(pro, "POST", `/leads/${lead.id}/quotes`, { title: "X" })).status).toBe(404);
  });
});
