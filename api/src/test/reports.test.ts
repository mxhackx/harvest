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
  const email = `report-${run}-${n++}@test.dev`;
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

const report = async (s: S, q = "") => (await http(s, "GET", `/reports${q}`)).json() as any;
const move = (s: S, id: string, body: object) => http(s, "PATCH", `/leads/${id}`, body);
const stage = (r: any, key: string) => r.pipeline.stages.find((x: any) => x.key === key);

describe("rapports : entreprise vide", () => {
  it("renvoie des zéros et des taux nuls, jamais NaN", async () => {
    const { ceo } = await setup();
    const r = await report(ceo);
    expect(r.pipeline).toMatchObject({ openCount: 0, openValue: 0, openWeighted: 0 });
    expect(r.funnel).toMatchObject({ cohort: 0, won: 0, lost: 0, winRate: null });
    expect(r.funnel.stages.every((s: any) => s.ofCohort === null && s.fromPrevious === null)).toBe(true);
    expect(r.closed).toEqual({ won: 0, wonValue: 0, lost: 0, lostReasons: [] });
    expect(r.reps).toEqual([]);
    expect(JSON.stringify(r)).not.toContain("NaN");
  });
});

describe("rapports : pipeline en valeur", () => {
  it("valeur et valeur pondérée par étape (probabilités par défaut : 10 / 30 / 60 / 90 %)", async () => {
    const { ceo } = await setup();
    await mkLead(ceo, "A", { estimatedValue: 1000 }); // À visiter 10 %
    await mkLead(ceo, "B", { estimatedValue: 2000, status: "interested" }); // 30 %
    await mkLead(ceo, "C", { estimatedValue: 5000, status: "won" });
    await mkLead(ceo, "D", { estimatedValue: 9000, status: "lost" });
    const r = await report(ceo);
    expect(stage(r, "to_visit")).toMatchObject({ count: 1, value: 1000, weighted: 100 });
    expect(stage(r, "interested")).toMatchObject({ count: 1, value: 2000, weighted: 600 });
    expect(stage(r, "won")).toMatchObject({ count: 1, value: 5000, weighted: 0 });
    // gagnés et perdus ne comptent pas dans le pipeline ouvert
    expect(r.pipeline).toMatchObject({ openCount: 2, openValue: 3000, openWeighted: 700 });
  });
});

describe("rapports : conversion", () => {
  it("entonnoir réel : les déplacements enregistrés donnent les étapes atteintes", async () => {
    const { ceo } = await setup();
    const a = await mkLead(ceo, "A");
    const b = await mkLead(ceo, "B");
    const c = await mkLead(ceo, "C");
    const d = await mkLead(ceo, "D");
    await move(ceo, a.id, { status: "interested" });
    await move(ceo, b.id, { status: "interested" });
    await move(ceo, b.id, { status: "won" });
    await move(ceo, c.id, { status: "interested" });
    await move(ceo, c.id, { status: "lost", lostReason: "Trop cher" });
    void d;
    const r = await report(ceo);
    const reached = Object.fromEntries(r.funnel.stages.map((s: any) => [s.key, s.reached]));
    expect(reached).toMatchObject({ to_visit: 4, interested: 3, won: 1 });
    expect(r.funnel).toMatchObject({ cohort: 4, won: 1, lost: 1, inProgress: 2, winRate: 0.5 });
    expect(r.funnel.stages.find((s: any) => s.key === "interested").fromPrevious).toBe(0.75);
  });

  it("motifs de perte et gains de la période", async () => {
    const { ceo } = await setup();
    const a = await mkLead(ceo, "A", { estimatedValue: 400 });
    const b = await mkLead(ceo, "B");
    const c = await mkLead(ceo, "C");
    await move(ceo, a.id, { status: "won" });
    await move(ceo, b.id, { status: "lost", lostReason: "Trop cher" });
    await move(ceo, c.id, { status: "lost", lostReason: "Trop cher" });
    const r = await report(ceo);
    expect(r.closed).toEqual({ won: 1, wonValue: 400, lost: 2, lostReasons: [{ reason: "Trop cher", count: 2 }] });
  });

  it("la période borne la cohorte : une période future ne contient rien", async () => {
    const { ceo } = await setup();
    await mkLead(ceo, "A");
    const from = new Date(Date.now() + 2 * 24 * 3600_000).toISOString();
    const to = new Date(Date.now() + 5 * 24 * 3600_000).toISOString();
    const r = await report(ceo, `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    expect(r.funnel.cohort).toBe(0);
    expect(r.reps).toEqual([]);
    expect(r.pipeline.openCount).toBe(1); // la photo du pipeline, elle, ne dépend pas de la période
  });

  it("valide la période", async () => {
    const { ceo } = await setup();
    const now = new Date();
    const iso = (d: number) => encodeURIComponent(new Date(now.getTime() + d * 24 * 3600_000).toISOString());
    expect((await http(ceo, "GET", `/reports?from=${iso(1)}&to=${iso(0)}`)).status).toBe(400);
    expect((await http(ceo, "GET", `/reports?from=${iso(-400)}&to=${iso(0)}`)).status).toBe(400);
    expect((await http(ceo, "GET", "/reports?from=hier")).status).toBe(400);
    expect((await http(ceo, "GET", `/reports?from=${iso(-365)}&to=${iso(0)}`)).status).toBe(200);
  });
});

describe("rapports : activité par personne", () => {
  it("compte par auteur : leads créés, appels, notes, changements d'étape, gains, tâches terminées", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur", "Prospecteur");
    const l1 = await mkLead(p, "L1", { estimatedValue: 300 });
    await mkLead(p, "L2");
    await http(p, "POST", `/leads/${l1.id}/activities`, { kind: "call", body: "x" });
    await http(p, "POST", `/leads/${l1.id}/activities`, { kind: "call", body: "y" });
    await http(p, "POST", `/leads/${l1.id}/activities`, { kind: "note", body: "z" });
    await move(p, l1.id, { status: "won" });
    const t = (await http(p, "POST", "/tasks", { title: "t" })).json();
    await http(p, "PATCH", `/tasks/${t.id}`, { done: true });
    const lc = await mkLead(ceo, "du CEO");
    await http(ceo, "POST", `/leads/${lc.id}/activities`, { kind: "visit", body: "v" });
    const r = await report(ceo);
    const byName = Object.fromEntries(r.reps.map((x: any) => [x.name, x]));
    expect(byName.Prospecteur).toMatchObject({ leadsCreated: 2, calls: 2, notes: 1, stageChanges: 1, won: 1, wonValue: 300, tasksDone: 1, visits: 0 });
    expect(byName["Le CEO"]).toMatchObject({ leadsCreated: 1, visits: 1, won: 0 });
    expect(r.reps[0].name).toBe("Prospecteur"); // le plus gros gain d'abord
  });
});

describe("rapports : droits et isolation", () => {
  it("un prospecteur ne voit que ses chiffres, jamais ceux des autres", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur", "Prospecteur");
    await mkLead(p, "Le mien", { estimatedValue: 100 });
    await mkLead(ceo, "Celui du CEO", { estimatedValue: 9999 });
    const r = await report(p);
    expect(r.pipeline.openValue).toBe(100);
    expect(r.funnel.cohort).toBe(1);
    expect(r.reps.map((x: any) => x.name)).toEqual(["Prospecteur"]);
    expect(JSON.stringify(r)).not.toContain("Le CEO");
    expect((await report(ceo)).pipeline.openValue).toBe(10099);
  });

  it("isolation entre entreprises", async () => {
    const a = await setup();
    const b = await setup();
    await mkLead(a.ceo, "Secret", { estimatedValue: 777 });
    const r = await report(b.ceo);
    expect(r.pipeline.openValue).toBe(0);
    expect(r.reps).toEqual([]);
  });

  it("exige la connexion et le droit de lire les leads", async () => {
    expect((await http(null, "GET", "/reports")).status).toBe(401);
    const { add } = await setup();
    const worker = await add("worker");
    expect((await http(worker, "GET", "/reports")).status).toBe(200); // lead:read (équipe)
  });
});
