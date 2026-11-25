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
  const email = `tour-${label}-${run}-${n++}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: label, password: "motdepasse-ok" }) });
  return { cookie: reg.headers.getSetCookie()[0].split(";")[0], email };
}
async function ceo(): Promise<S> {
  const s = await register("ceo");
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}
const START = { lat: 6.36, lng: 2.38, label: "Hôtel" };
const lead = async (s: S, name: string, lng: number, extra: object = {}) => (await http(s, "POST", "/leads", { name, lat: 6.36, lng, ...extra })).json() as { id: string };

describe("tournées", () => {
  it("calcule l'itinéraire, réordonne au plus proche et donne les horaires", async () => {
    const s = await ceo();
    const far = await lead(s, "Loin", 2.44);
    const near = await lead(s, "Proche", 2.39);
    const mid = await lead(s, "Milieu", 2.41);
    const plan = (await http(s, "POST", "/tours/plan", { start: START, leadIds: [far.id, near.id, mid.id], optimize: true, startTime: "08:00", stopMinutes: 20 })).json();
    expect(plan.stops.map((x: { name: string }) => x.name)).toEqual(["Proche", "Milieu", "Loin"]);
    expect(plan.legs).toHaveLength(3); // départ → 3 étapes
    expect(plan.approximate).toBe(true); // pas de service d'itinéraires en test
    expect(plan.arrivals).toHaveLength(3);
    expect(plan.arrivals[0] > "08:00").toBe(true);
    expect(plan.totalMin).toBeGreaterThan(plan.drivingMin); // + le temps passé sur place
    expect(plan.totalKm).toBeGreaterThan(0);

    // sans optimisation, l'ordre demandé est gardé
    const kept = (await http(s, "POST", "/tours/plan", { start: START, leadIds: [far.id, near.id], optimize: false })).json();
    expect(kept.stops.map((x: { name: string }) => x.name)).toEqual(["Loin", "Proche"]);
  });

  it("avec une arrivée fixée (retour au départ), la tournée y finit", async () => {
    const s = await ceo();
    const a = await lead(s, "A", 2.4);
    const b = await lead(s, "B", 2.42);
    const plan = (await http(s, "POST", "/tours/plan", { start: START, end: START, leadIds: [b.id, a.id], optimize: true })).json();
    expect(plan.legs).toHaveLength(3); // départ → A → B → retour
    expect(plan.geometry[plan.geometry.length - 1]).toEqual([START.lng, START.lat]);
  });

  it("refuse les prospects à distance, sans position, inconnus ou hors de portée", async () => {
    const s = await ceo();
    const ok = await lead(s, "Bon", 2.4);
    const remote = await lead(s, "À distance", 2.41, { visitMode: "remote" });
    const noPos = (await http(s, "POST", "/leads", { name: "Sans position" })).json() as { id: string };
    const res = await http(s, "POST", "/tours/plan", { start: START, leadIds: [ok.id, remote.id, noPos.id, "00000000-0000-0000-0000-000000000000"] });
    expect(res.status).toBe(400);
    expect(res.json().refused.sort()).toEqual([remote.id, noPos.id, "00000000-0000-0000-0000-000000000000"].sort());
    expect((await http(s, "POST", "/tours/plan", { start: START, leadIds: [] })).status).toBe(400);
  });

  it("enregistre une tournée personnelle, la liste, la marque faite et la supprime", async () => {
    const s = await ceo();
    const a = await lead(s, "Étape 1", 2.4);
    const b = await lead(s, "Étape 2", 2.42);
    const saved = (await http(s, "POST", "/tours", { name: "Mardi Cotonou", plannedOn: "2026-12-01", start: START, leadIds: [b.id, a.id], optimize: true })).json();
    expect(saved).toMatchObject({ name: "Mardi Cotonou", status: "planned" });
    expect(saved.stops.map((x: { name: string }) => x.name)).toEqual(["Étape 1", "Étape 2"]);
    expect(saved.arrivals).toHaveLength(2);

    expect((await http(s, "GET", "/tours")).json()).toHaveLength(1);
    expect((await http(s, "PATCH", `/tours/${saved.id}`, { status: "done" })).json().status).toBe("done");

    // la tournée est celle de son auteur : un collègue ne la voit pas
    const roles = Object.fromEntries((await http(s, "GET", "/roles")).json().map((r: { key: string; id: string }) => [r.key, r.id]));
    const other = await register("manager");
    other.companyId = s.companyId;
    await http(s, "POST", "/members", { email: other.email, roleIds: [roles.manager] });
    expect((await http(other, "GET", "/tours")).json()).toHaveLength(0);
    expect((await http(other, "GET", `/tours/${saved.id}`)).status).toBe(404);
    expect((await http(other, "DELETE", `/tours/${saved.id}`)).status).toBe(404);

    expect((await http(s, "DELETE", `/tours/${saved.id}`)).status).toBe(204);
    expect((await http(s, "GET", "/tours")).json()).toHaveLength(0);
  });
});
