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
  const email = `cf-${label}-${run}-${n++}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: label, password: "motdepasse-ok" }) });
  return { cookie: reg.headers.getSetCookie()[0].split(";")[0], email };
}
async function ceo(): Promise<S> {
  const s = await register("ceo");
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}

describe("champs personnalisés", () => {
  it("les valeurs saisies sur un lead sont vérifiées, gardées, modifiables, et disparaissent avec le champ", async () => {
    const s = await ceo();
    const size = (await http(s, "POST", "/custom-fields", { label: "Taille", type: "select", options: ["Petite", "Grande"] })).json();
    const staff = (await http(s, "POST", "/custom-fields", { label: "Effectif", type: "number" })).json();

    const lead = (await http(s, "POST", "/leads", { name: "Boulangerie", custom: { [size.id]: "Grande", [staff.id]: 12 } })).json();
    expect(lead.custom).toEqual({ [size.id]: "Grande", [staff.id]: 12 });
    expect((await http(s, "POST", "/leads", { name: "Mauvais", custom: { [staff.id]: "douze" } })).status).toBe(400);
    expect((await http(s, "PATCH", `/leads/${lead.id}`, { custom: { [size.id]: "Moyenne" } })).status).toBe(400);

    const patched = (await http(s, "PATCH", `/leads/${lead.id}`, { custom: { [staff.id]: null } })).json();
    expect(patched.custom).toEqual({ [size.id]: "Grande" }); // l'autre valeur est conservée

    expect((await http(s, "DELETE", `/custom-fields/${size.id}`)).status).toBe(204);
    expect((await http(s, "GET", "/leads")).json()[0].custom).toEqual({});
  });

  it("refuse les doublons et les listes sans choix, et réserve la gestion à ceux qui en ont le droit", async () => {
    const s = await ceo();
    await http(s, "POST", "/custom-fields", { label: "Enseigne", type: "text" });
    expect((await http(s, "POST", "/custom-fields", { label: "enseigne", type: "text" })).status).toBe(409);
    expect((await http(s, "POST", "/custom-fields", { label: "Liste", type: "select", options: ["Un seul"] })).status).toBe(400);
    const roles = Object.fromEntries((await http(s, "GET", "/roles")).json().map((r: { key: string; id: string }) => [r.key, r.id]));
    const pro = await register("pro");
    pro.companyId = s.companyId;
    await http(s, "POST", "/members", { email: pro.email, roleIds: [roles.prospecteur] });
    expect((await http(pro, "GET", "/custom-fields")).status).toBe(200);
    expect((await http(pro, "POST", "/custom-fields", { label: "Interdit", type: "text" })).status).toBe(403);
  });
});
