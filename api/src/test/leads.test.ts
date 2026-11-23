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
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(s ? { cookie: s.cookie, ...(s.companyId ? { "x-company-id": s.companyId } : {}) } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: () => JSON.parse(text), setCookie: res.headers.getSetCookie() };
}
async function user(): Promise<S> {
  const email = `lead-${run}-${n++}@test.dev`;
  const r = await http(null, "POST", "/auth/register", { email, name: "T", password: "motdepasse-ok" });
  return { email, cookie: r.setCookie[0].split(";")[0] };
}
async function setup() {
  const ceo = await user();
  const c = await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" });
  ceo.companyId = c.json().company.id;
  const team1 = c.json().team.id;
  const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: any) => [r.key, r.id]));
  const add = async (key: string, teamId: string | null = team1) => {
    const u = await user();
    expect((await http(ceo, "POST", "/members", { email: u.email, roleIds: [roles[key]], teamId })).status).toBe(201);
    u.companyId = ceo.companyId;
    return u;
  };
  return { ceo, add, team1 };
}
const mk = (s: S, name: string, extra = {}) => http(s, "POST", "/leads", { name, ...extra });

describe("leads", () => {
  it("crée un lead avec coordonnées, le liste, le marque visité", async () => {
    const { ceo } = await setup();
    const r = await mk(ceo, "Boulangerie", { lat: 6.37, lng: 2.42, sector: "Commerce" });
    expect(r.status).toBe(201);
    const lead = r.json();
    expect(lead.status).toBe("to_visit");
    expect(lead.visitedAt).toBeNull();
    const up = await http(ceo, "PATCH", `/leads/${lead.id}`, { visited: true });
    expect(up.json().visitedAt).not.toBeNull();
    const back = await http(ceo, "PATCH", `/leads/${lead.id}`, { visited: false });
    expect(back.json().visitedAt).toBeNull();
    expect((await http(ceo, "GET", "/leads")).json()).toHaveLength(1);
  });

  it("valide les entrées (lat sans lng, statut inconnu, coordonnées hors bornes)", async () => {
    const { ceo } = await setup();
    expect((await mk(ceo, "A", { lat: 6.3 })).status).toBe(400);
    expect((await mk(ceo, "A", { status: "gagné" })).status).toBe(400);
    expect((await mk(ceo, "A", { lat: 99, lng: 2 })).status).toBe(400);
    expect((await mk(ceo, "")).status).toBe(400);
  });

  it("portée own : un prospecteur ne voit que ses leads", async () => {
    const { ceo, add } = await setup();
    const p1 = await add("prospecteur");
    const p2 = await add("prospecteur");
    await mk(p1, "L-p1");
    await mk(p2, "L-p2");
    await mk(ceo, "L-ceo");
    expect((await http(p1, "GET", "/leads")).json().map((l: any) => l.name)).toEqual(["L-p1"]);
    expect((await http(ceo, "GET", "/leads")).json()).toHaveLength(3);
  });

  it("portée team : un taffeur voit son équipe, pas une autre", async () => {
    const { ceo, add, team1 } = await setup();
    const team2 = (await http(ceo, "POST", "/teams", { name: "T2" })).json().id;
    const w1 = await add("worker", team1);
    const w2 = await add("worker", team2);
    const lead = (await mk(ceo, "L-ceo-t1")).json(); // équipe du CEO = team1
    await mk(w2, "L-w2");
    expect((await http(w1, "GET", "/leads")).json().map((l: any) => l.name)).toEqual(["L-ceo-t1"]);
    // w2 ne peut ni lire ni modifier un lead d'une autre équipe : 404, pas 403
    expect((await http(w2, "PATCH", `/leads/${lead.id}`, { name: "x" })).status).toBe(404);
    expect((await http(w1, "PATCH", `/leads/${lead.id}`, { name: "ok" })).status).toBe(200);
  });

  it("un prospecteur ne modifie pas le lead d'un autre ni ne supprime (pas de droit)", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const other = (await mk(ceo, "L-ceo")).json();
    expect((await http(p, "PATCH", `/leads/${other.id}`, { name: "x" })).status).toBe(404);
    const mine = (await mk(p, "L-p")).json();
    expect((await http(p, "PATCH", `/leads/${mine.id}`, { name: "renommé" })).status).toBe(200);
    expect((await http(p, "DELETE", `/leads/${mine.id}`)).status).toBe(403);
  });

  it("un affilié crée mais ne peut ni modifier ni voir les autres", async () => {
    const { ceo, add } = await setup();
    const a = await add("affilie");
    const mine = (await mk(a, "L-a")).json();
    await mk(ceo, "L-ceo");
    expect((await http(a, "GET", "/leads")).json()).toHaveLength(1);
    expect((await http(a, "PATCH", `/leads/${mine.id}`, { name: "x" })).status).toBe(403);
  });

  it("isolation entre entreprises", async () => {
    const a = await setup();
    const b = await setup();
    const lead = (await mk(a.ceo, "secret")).json();
    expect((await http(b.ceo, "GET", "/leads")).json()).toHaveLength(0);
    expect((await http(b.ceo, "PATCH", `/leads/${lead.id}`, { name: "pwned" })).status).toBe(404);
    expect((await http(b.ceo, "DELETE", `/leads/${lead.id}`)).status).toBe(404);
    const forged = { ...a.ceo, companyId: b.ceo.companyId };
    expect((await http(forged, "GET", "/leads")).status).toBe(403);
  });

  it("exige l'authentification", async () => {
    expect((await http(null, "GET", "/leads")).status).toBe(401);
  });

  it("actions de masse : statut et visite, limitées à la portée, avec compte des ignorés", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const mine = (await mk(p, "mien")).json();
    const theirs = (await mk(ceo, "autre")).json();
    const r = await http(p, "POST", "/leads/bulk-update", { ids: [mine.id, theirs.id], status: "interested", visited: true });
    expect(r.status).toBe(200);
    expect(r.json()).toEqual({ affected: 1, skipped: 1 });
    const all = (await http(ceo, "GET", "/leads")).json();
    const byName = Object.fromEntries(all.map((l: any) => [l.name, l]));
    expect(byName["mien"].status).toBe("interested");
    expect(byName["mien"].visitedAt).not.toBeNull();
    expect(byName["autre"].status).toBe("to_visit");
    // le CEO peut tout modifier, et repasser à « à visiter »
    const back = await http(ceo, "POST", "/leads/bulk-update", { ids: [mine.id, theirs.id], visited: false });
    expect(back.json()).toEqual({ affected: 2, skipped: 0 });
  });

  it("actions de masse : validation des entrées", async () => {
    const { ceo } = await setup();
    const id = crypto.randomUUID();
    expect((await http(ceo, "POST", "/leads/bulk-update", { ids: [], status: "interested" })).status).toBe(400);
    expect((await http(ceo, "POST", "/leads/bulk-update", { ids: [id] })).status).toBe(400);
    expect((await http(ceo, "POST", "/leads/bulk-update", { ids: ["pas-un-uuid"], status: "interested" })).status).toBe(400);
    expect((await http(ceo, "POST", "/leads/bulk-update", { ids: [id], status: "gagné" })).status).toBe(400);
    const tooMany = Array.from({ length: 201 }, () => crypto.randomUUID());
    expect((await http(ceo, "POST", "/leads/bulk-delete", { ids: tooMany })).status).toBe(400);
  });

  it("suppression de masse : droit requis, entreprise étanche", async () => {
    const a = await setup();
    const b = await setup();
    const l1 = (await mk(a.ceo, "a1")).json();
    const l2 = (await mk(a.ceo, "a2")).json();
    const foreign = (await mk(b.ceo, "b1")).json();
    const w = await a.add("worker"); // pas de lead:delete
    expect((await http(w, "POST", "/leads/bulk-delete", { ids: [l1.id] })).status).toBe(403);
    // ids d'une autre entreprise : ignorés, jamais supprimés
    const r = await http(a.ceo, "POST", "/leads/bulk-delete", { ids: [l1.id, foreign.id] });
    expect(r.json()).toEqual({ affected: 1, skipped: 1 });
    expect((await http(b.ceo, "GET", "/leads")).json()).toHaveLength(1);
    expect((await http(a.ceo, "GET", "/leads")).json().map((l: any) => l.name)).toEqual(["a2"]);
    void l2;
    // doublons dans la demande : comptés une seule fois
    const dup = await http(a.ceo, "POST", "/leads/bulk-delete", { ids: [l2.id, l2.id] });
    expect(dup.json()).toEqual({ affected: 1, skipped: 0 });
  });
});
