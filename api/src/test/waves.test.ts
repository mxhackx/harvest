import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { client } from "../db/index.js";
import { wavePhase, periodBounds } from "../waves/stats.js";

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
  return { status: res.status, json: () => (text ? JSON.parse(text) : null) };
}
async function register(label: string): Promise<S> {
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `wave-${label}-${run}-${n++}@test.dev`, name: label, password: "motdepasse-ok" }) });
  return { cookie: reg.headers.getSetCookie()[0].split(";")[0] };
}
async function ceo(): Promise<S> {
  const s = await register("ceo");
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
// Cotonou ; Porto-Novo est à environ 30 km
const COTONOU = { lat: 6.3703, lng: 2.3912 };
const PORTO_NOVO = { lat: 6.4969, lng: 2.6289 };

describe("wavePhase / periodBounds", () => {
  it("à venir, en cours, en retard ou clôturée", () => {
    const w = { startsOn: "2026-11-10", endsOn: "2026-11-16", closedAt: null };
    expect(wavePhase(w, "2026-11-09")).toBe("planned");
    expect(wavePhase(w, "2026-11-10")).toBe("active");
    expect(wavePhase(w, "2026-11-16")).toBe("active");
    expect(wavePhase(w, "2026-11-17")).toBe("overdue");
    expect(wavePhase({ ...w, closedAt: new Date() }, "2026-11-17")).toBe("closed");
  });
  it("la période inclut le dernier jour en entier", () => {
    const { from, to } = periodBounds("2026-11-10", "2026-11-16");
    expect(from.toISOString()).toBe("2026-11-10T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-17T00:00:00.000Z");
  });
});

describe("régions : la région d'un lead vient de sa position", () => {
  it("un lead entre dans la région qui le contient, change de région quand elle bouge, et n'en a plus sans position", async () => {
    const s = await ceo();
    const cotonou = (await http(s, "POST", "/regions", { name: "Cotonou", ...COTONOU, radiusKm: 10 })).json();
    const inside = (await http(s, "POST", "/leads", { name: "Dans Cotonou", ...COTONOU })).json();
    const outside = (await http(s, "POST", "/leads", { name: "Porto-Novo", ...PORTO_NOVO })).json();
    const nowhere = (await http(s, "POST", "/leads", { name: "Sans position" })).json();
    const regionOf = async (id: string) => (await http(s, "GET", "/leads")).json().find((l: { id: string }) => l.id === id).regionId;
    expect(await regionOf(inside.id)).toBe(cotonou.id);
    expect(await regionOf(outside.id)).toBeNull();
    expect(await regionOf(nowhere.id)).toBeNull();

    // une région créée après coup reprend les leads déjà là ; le plus proche centre gagne si deux régions se recouvrent
    const porto = (await http(s, "POST", "/regions", { name: "Porto-Novo", ...PORTO_NOVO, radiusKm: 50 })).json();
    expect(await regionOf(outside.id)).toBe(porto.id);
    expect(await regionOf(inside.id)).toBe(cotonou.id);

    // le lead déménage : sa région suit
    await http(s, "PATCH", `/leads/${inside.id}`, { ...PORTO_NOVO });
    expect(await regionOf(inside.id)).toBe(porto.id);

    expect((await http(s, "GET", "/regions")).json().find((r: { id: string }) => r.id === porto.id).leadCount).toBe(2);
    expect((await http(s, "POST", "/regions", { name: "cotonou", ...COTONOU, radiusKm: 5 })).status).toBe(409); // nom déjà pris
  });
});

describe("vagues", () => {
  it("le bilan compte les visités, les convertis et les leads à repasser, et se fige à la clôture", async () => {
    const s = await ceo();
    const region = (await http(s, "POST", "/regions", { name: "Cotonou", ...COTONOU, radiusKm: 10 })).json();
    const stages = (await http(s, "GET", "/stages")).json() as { key: string; kind: string }[];
    const won = stages.find((st) => st.kind === "won")!.key;
    const visited = (await http(s, "POST", "/leads", { name: "Visité", ...COTONOU })).json();
    const converted = (await http(s, "POST", "/leads", { name: "Converti", ...COTONOU })).json();
    const todo = (await http(s, "POST", "/leads", { name: "À repasser", ...COTONOU })).json();
    await http(s, "POST", "/leads", { name: "Ailleurs", ...PORTO_NOVO }); // hors région : ne compte pas

    const wave = (await http(s, "POST", "/waves", { regionId: region.id, name: "Semaine 47", startsOn: iso(-3), endsOn: iso(3), targetVisits: 3 })).json();
    expect(wave.phase).toBe("active");
    expect(wave.stats).toMatchObject({ total: 3, visited: 0, converted: 0, toRevisit: 3, targetVisits: 3 });

    await http(s, "PATCH", `/leads/${visited.id}`, { visited: true });
    await http(s, "PATCH", `/leads/${converted.id}`, { visited: true, status: won });
    const live = (await http(s, "GET", "/waves")).json()[0];
    expect(live.stats).toMatchObject({ total: 3, visited: 2, converted: 1, toRevisit: 1 });
    const revisit = (await http(s, "GET", `/waves/${wave.id}/revisit`)).json();
    expect(revisit.map((l: { id: string }) => l.id)).toEqual([todo.id]);

    const closed = (await http(s, "POST", `/waves/${wave.id}/close`)).json();
    expect(closed.phase).toBe("closed");
    expect(closed.bilan).toMatchObject({ visited: 2, converted: 1, toRevisit: 1 });
    // le bilan est figé : un lead visité ensuite ne le change pas
    await http(s, "PATCH", `/leads/${todo.id}`, { visited: true });
    expect((await http(s, "GET", "/waves")).json()[0].stats).toMatchObject({ visited: 2, toRevisit: 1 });
    expect((await http(s, "POST", `/waves/${wave.id}/close`)).status).toBe(409);
    expect((await http(s, "PATCH", `/waves/${wave.id}`, { name: "x" })).status).toBe(409);
  });

  it("une période incohérente est refusée, une région avec des vagues ne se supprime pas, et seuls ceux qui ont le droit gèrent", async () => {
    const s = await ceo();
    const region = (await http(s, "POST", "/regions", { name: "Zone", ...COTONOU, radiusKm: 5 })).json();
    expect((await http(s, "POST", "/waves", { regionId: region.id, name: "X", startsOn: iso(5), endsOn: iso(1) })).status).toBe(400);
    await http(s, "POST", "/waves", { regionId: region.id, name: "Y", startsOn: iso(0), endsOn: iso(6) });
    expect((await http(s, "DELETE", `/regions/${region.id}`)).status).toBe(409);

    // un prospecteur lit les vagues mais ne les crée pas
    const roles = Object.fromEntries((await http(s, "GET", "/roles")).json().map((r: { key: string; id: string }) => [r.key, r.id]));
    const email = `wave-pro-${run}@test.dev`;
    const res = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: "P", password: "motdepasse-ok" }) });
    const pro: S = { cookie: res.headers.getSetCookie()[0].split(";")[0], companyId: s.companyId };
    expect((await http(s, "POST", "/members", { email, roleIds: [roles.prospecteur] })).status).toBe(201);
    expect((await http(pro, "GET", "/waves")).status).toBe(200);
    expect((await http(pro, "POST", "/waves", { regionId: region.id, name: "Z", startsOn: iso(0), endsOn: iso(1) })).status).toBe(403);
    expect((await http(pro, "POST", "/regions", { name: "R", ...COTONOU, radiusKm: 1 })).status).toBe(403);
  });
});
