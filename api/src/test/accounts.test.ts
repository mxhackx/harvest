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
  const email = `acc-${label}-${run}-${n++}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: label, password: "motdepasse-ok" }) });
  return { cookie: reg.headers.getSetCookie()[0].split(";")[0], email };
}
async function ceo(): Promise<S> {
  const s = await register("ceo");
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}

describe("comptes et opportunités", () => {
  it("un compte regroupe plusieurs opportunités, avec leur valeur en cours et gagnée", async () => {
    const s = await ceo();
    const won = ((await http(s, "GET", "/stages")).json() as { key: string; kind: string }[]).find((st) => st.kind === "won")!.key;
    const first = (await http(s, "POST", "/leads", { name: "Boulangerie Soleil", sector: "Alimentation", estimatedValue: 100_000 })).json();
    const account = (await http(s, "POST", `/leads/${first.id}/account`)).json();
    expect(account).toMatchObject({ name: "Boulangerie Soleil", sector: "Alimentation" });

    const second = (await http(s, "POST", "/leads", { name: "Soleil — site vitrine", accountId: account.id, estimatedValue: 40_000 })).json();
    await http(s, "PATCH", `/leads/${second.id}`, { status: won });
    const [row] = (await http(s, "GET", "/accounts")).json();
    expect(row).toMatchObject({ id: account.id, opportunities: 2, openValue: 100_000, wonValue: 40_000 });

    const detail = (await http(s, "GET", `/accounts/${account.id}`)).json();
    expect(detail.leads.map((l: { name: string }) => l.name)).toEqual(["Boulangerie Soleil", "Soleil — site vitrine"]);
    expect((await http(s, "POST", `/leads/${first.id}/account`)).status).toBe(409); // déjà rattaché
  });

  it("supprimer un compte détache ses leads sans les perdre ; un compte inconnu ou en double est refusé", async () => {
    const s = await ceo();
    const account = (await http(s, "POST", "/accounts", { name: "Pharmacie du Port" })).json();
    const lead = (await http(s, "POST", "/leads", { name: "Opportunité", accountId: account.id })).json();
    expect((await http(s, "POST", "/accounts", { name: "pharmacie du port" })).status).toBe(409);
    expect((await http(s, "POST", "/leads", { name: "X", accountId: "00000000-0000-0000-0000-000000000000" })).status).toBe(400);
    expect((await http(s, "DELETE", `/accounts/${account.id}`)).status).toBe(204);
    const kept = (await http(s, "GET", "/leads")).json().find((l: { id: string }) => l.id === lead.id);
    expect(kept.accountId).toBeNull();
    expect((await http(s, "GET", `/accounts/${account.id}`)).status).toBe(404);
  });

  it("un prospecteur voit les comptes mais seulement ses propres opportunités, et ne les gère pas", async () => {
    const s = await ceo();
    const account = (await http(s, "POST", "/accounts", { name: "Groupe Étoile" })).json();
    await http(s, "POST", "/leads", { name: "Lead du CEO", accountId: account.id, estimatedValue: 1000 });
    const roles = Object.fromEntries((await http(s, "GET", "/roles")).json().map((r: { key: string; id: string }) => [r.key, r.id]));
    const pro = await register("pro");
    pro.companyId = s.companyId;
    await http(s, "POST", "/members", { email: pro.email, roleIds: [roles.prospecteur] });
    await http(pro, "POST", "/leads", { name: "Lead du prospecteur", accountId: account.id, estimatedValue: 50 });
    const [row] = (await http(pro, "GET", "/accounts")).json();
    expect(row).toMatchObject({ name: "Groupe Étoile", opportunities: 1, openValue: 50 }); // pas les 1000 du CEO
    expect((await http(pro, "POST", "/accounts", { name: "Interdit" })).status).toBe(403);
    expect((await http(pro, "DELETE", `/accounts/${account.id}`)).status).toBe(403);
  });
});
