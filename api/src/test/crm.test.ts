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

type S = { cookie: string; companyId?: string; email: string };
const run = Math.random().toString(36).slice(2, 8);
let n = 0;
async function http(s: S | null, method: string, url: string, body?: unknown) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(s ? { cookie: s.cookie, ...(s.companyId ? { "x-company-id": s.companyId } : {}) } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text, json: () => JSON.parse(text), setCookie: res.headers.getSetCookie() };
}
async function user(name = "T"): Promise<S> {
  const email = `crm-${run}-${n++}@test.dev`;
  const r = await http(null, "POST", "/auth/register", { email, name, password: "motdepasse-ok" });
  return { email, cookie: r.setCookie[0].split(";")[0] };
}
async function setup() {
  const ceo = await user("Le CEO");
  const c = await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" });
  ceo.companyId = c.json().company.id;
  const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: any) => [r.key, r.id]));
  const add = async (key: string, name = "Membre") => {
    const u = await user(name);
    await http(ceo, "POST", "/members", { email: u.email, roleIds: [roles[key]] });
    u.companyId = ceo.companyId;
    return u;
  };
  return { ceo, add };
}
const mkLead = async (s: S, name: string, extra = {}) => (await http(s, "POST", "/leads", { name, ...extra })).json();

const tpl = (s: S, body: object) => http(s, "POST", "/templates", body);
const good = { name: "Premier contact", channel: "whatsapp", body: "Bonjour {{contact}}, ici {{moi}} de Harvest." };
const cfg = { tab: "all", query: "", sort: "recent", filters: { visit: "all", position: "all", sector: "" } };

describe("modèles de messages", () => {
  it("le CEO crée, modifie et supprime ; tous les membres lisent, triés par nom", async () => {
    const { ceo, add } = await setup();
    const w = await add("worker");
    const a = (await tpl(ceo, good)).json();
    expect(a).toMatchObject({ name: "Premier contact", channel: "whatsapp" });
    await tpl(ceo, { name: "Alpha", channel: "email", body: "x" });
    expect(((await http(w, "GET", "/templates")).json() as any[]).map((x) => x.name)).toEqual(["Alpha", "Premier contact"]);
    expect((await http(ceo, "PATCH", `/templates/${a.id}`, { body: "Salut {{contact}}" })).json().body).toBe("Salut {{contact}}");
    expect((await http(ceo, "DELETE", `/templates/${a.id}`)).status).toBe(204);
    expect((await http(ceo, "DELETE", `/templates/${a.id}`)).status).toBe(404);
  });

  it("valide les champs ; deux modèles ne portent pas le même nom (casse ignorée)", async () => {
    const { ceo } = await setup();
    expect((await tpl(ceo, {})).status).toBe(400);
    expect((await tpl(ceo, { ...good, name: " " })).status).toBe(400);
    expect((await tpl(ceo, { ...good, channel: "sms" })).status).toBe(400);
    expect((await tpl(ceo, { ...good, body: "x".repeat(2001) })).status).toBe(400);
    expect((await tpl(ceo, good)).status).toBe(201);
    expect((await tpl(ceo, { ...good, name: "PREMIER CONTACT" })).json().error).toBe("template_exists");
    const other = (await tpl(ceo, { ...good, name: "Autre" })).json();
    expect((await http(ceo, "PATCH", `/templates/${other.id}`, { name: "premier contact" })).status).toBe(409);
    expect((await http(ceo, "PATCH", `/templates/${other.id}`, {})).status).toBe(400);
  });

  it("seuls ceux qui ont template:* gèrent les modèles", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const t = (await tpl(ceo, good)).json();
    expect((await tpl(p, good)).status).toBe(403);
    expect((await http(p, "PATCH", `/templates/${t.id}`, { body: "x" })).status).toBe(403);
    expect((await http(p, "DELETE", `/templates/${t.id}`)).status).toBe(403);
    expect((await http(p, "GET", "/templates")).status).toBe(200);
    expect((await http(null, "GET", "/templates")).status).toBe(401);
  });

  it("isolation entre entreprises", async () => {
    const a = await setup();
    const b = await setup();
    const t = (await tpl(a.ceo, good)).json();
    expect(await (await http(b.ceo, "GET", "/templates")).json()).toEqual([]);
    expect((await http(b.ceo, "PATCH", `/templates/${t.id}`, { body: "pwned" })).status).toBe(404);
    expect((await http(b.ceo, "DELETE", `/templates/${t.id}`)).status).toBe(404);
    expect((await tpl(b.ceo, good)).status).toBe(201); // même nom autorisé ailleurs
  });
});

describe("segments", () => {
  it("chacun crée, liste et supprime les siens ; les autres ne les voient pas", async () => {
    const { ceo, add } = await setup();
    const m = await add("manager");
    const s = await http(ceo, "POST", "/segments", { name: "À visiter à Cotonou", config: { ...cfg, query: "cotonou" } });
    expect(s.status).toBe(201);
    expect(s.json().config.query).toBe("cotonou");
    expect(((await http(ceo, "GET", "/segments")).json() as any[]).length).toBe(1);
    expect(await (await http(m, "GET", "/segments")).json()).toEqual([]);
    expect((await http(m, "DELETE", `/segments/${s.json().id}`)).status).toBe(404);
    expect((await http(ceo, "DELETE", `/segments/${s.json().id}`)).status).toBe(204);
  });

  it("refuse une configuration inattendue, un nom vide ou en double", async () => {
    const { ceo } = await setup();
    const post = (b: object) => http(ceo, "POST", "/segments", b);
    expect((await post({ name: "", config: cfg })).status).toBe(400);
    expect((await post({ name: "x", config: { ...cfg, filters: { ...cfg.filters, visit: "nimporte" } } })).status).toBe(400);
    expect((await post({ name: "x", config: { tab: "all" } })).status).toBe(400);
    expect((await post({ name: "Vue", config: cfg })).status).toBe(201);
    expect((await post({ name: "vue", config: cfg })).json().error).toBe("segment_exists");
    // champs en trop : non conservés
    const kept = (await post({ name: "Propre", config: { ...cfg, evil: "<script>" } })).json();
    expect(kept.config).not.toHaveProperty("evil");
  });

  it("limite à 30 segments par personne ; la même vue peut exister chez deux personnes", async () => {
    const { ceo, add } = await setup();
    const m = await add("manager");
    for (let i = 0; i < 30; i++) expect((await http(ceo, "POST", "/segments", { name: `v${i}`, config: cfg })).status).toBe(201);
    expect((await http(ceo, "POST", "/segments", { name: "de trop", config: cfg })).json().error).toBe("too_many_segments");
    expect((await http(m, "POST", "/segments", { name: "v1", config: cfg })).status).toBe(201);
  });

  it("isolation et connexion exigée", async () => {
    const a = await setup();
    const b = await setup();
    const s = (await http(a.ceo, "POST", "/segments", { name: "Vue", config: cfg })).json();
    expect((await http(b.ceo, "DELETE", `/segments/${s.id}`)).status).toBe(404);
    expect((await http(null, "GET", "/segments")).status).toBe(401);
  });
});

describe("liste de tous les contacts", () => {
  const addC = (s: S, leadId: string, body: object) => http(s, "POST", `/leads/${leadId}/contacts`, body);

  it("réunit les contacts de tous les leads, avec le nom du lead, triés ; recherche par nom, fonction, téléphone ou lead", async () => {
    const { ceo } = await setup();
    const l1 = await mkLead(ceo, "Pharmacie du Port");
    const l2 = await mkLead(ceo, "Boulangerie Soleil");
    await addC(ceo, l1.id, { name: "Mme Adjovi", role: "Gérante", phone: "+229 97 00 11 22" });
    await addC(ceo, l1.id, { name: "Koffi", role: "Comptable" });
    await addC(ceo, l2.id, { name: "Awa" });
    const all = (await http(ceo, "GET", "/contacts")).json();
    expect(all.total).toBe(3);
    expect(all.items.map((c: any) => c.name)).toEqual(["Awa", "Koffi", "Mme Adjovi"]);
    expect(all.items[0]).toMatchObject({ leadName: "Boulangerie Soleil", leadId: l2.id });
    const find = async (q: string) => ((await http(ceo, "GET", `/contacts?q=${encodeURIComponent(q)}`)).json().items as any[]).map((c) => c.name);
    expect(await find("adjovi")).toEqual(["Mme Adjovi"]);
    expect(await find("comptable")).toEqual(["Koffi"]);
    expect(await find("+229 97")).toEqual(["Mme Adjovi"]);
    expect(await find("boulangerie")).toEqual(["Awa"]); // par nom de lead
    expect(await find("zzz")).toEqual([]);
  });

  it("les jokers LIKE sont neutralisés : « % » ne renvoie pas tout", async () => {
    const { ceo } = await setup();
    const l = await mkLead(ceo, "L");
    await addC(ceo, l.id, { name: "Awa" });
    await addC(ceo, l.id, { name: "Remise 50%" });
    expect(((await http(ceo, "GET", `/contacts?q=${encodeURIComponent("%")}`)).json().items as any[]).map((c) => c.name)).toEqual(["Remise 50%"]);
    expect(((await http(ceo, "GET", `/contacts?q=${encodeURIComponent("_")}`)).json().items as any[]).length).toBe(0);
  });

  it("pagination avec total", async () => {
    const { ceo } = await setup();
    const l = await mkLead(ceo, "L");
    for (const n of ["A", "B", "C", "D", "E"]) await addC(ceo, l.id, { name: n });
    const p1 = (await http(ceo, "GET", "/contacts?limit=2")).json();
    expect(p1.items.map((c: any) => c.name)).toEqual(["A", "B"]);
    expect(p1.total).toBe(5);
    expect(((await http(ceo, "GET", "/contacts?limit=2&offset=4")).json().items as any[]).map((c) => c.name)).toEqual(["E"]);
    expect((await http(ceo, "GET", "/contacts?limit=0")).status).toBe(400);
    expect((await http(ceo, "GET", "/contacts?limit=101")).status).toBe(400);
  });

  it("un prospecteur ne voit que les contacts de ses leads ; isolation entre entreprises", async () => {
    const a = await setup();
    const b = await setup();
    const p = await a.add("prospecteur");
    const mine = await mkLead(p, "Le mien", { contactName: "Mon contact" });
    await mkLead(a.ceo, "Celui du CEO", { contactName: "Contact CEO" });
    await mkLead(b.ceo, "Autre entreprise", { contactName: "Contact B" });
    expect(((await http(p, "GET", "/contacts")).json().items as any[]).map((c) => c.name)).toEqual(["Mon contact"]);
    expect(((await http(a.ceo, "GET", "/contacts")).json().items as any[]).map((c) => c.name).sort()).toEqual(["Contact CEO", "Mon contact"]);
    expect((await http(b.ceo, "GET", "/contacts")).json().total).toBe(1);
    void mine;
    expect((await http(null, "GET", "/contacts")).status).toBe(401);
  });
});
