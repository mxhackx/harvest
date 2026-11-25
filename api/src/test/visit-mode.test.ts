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
  return { status: res.status, json: () => (text ? JSON.parse(text) : null) };
}
async function ceo(): Promise<S> {
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `vm-${run}-${n++}@test.dev`, name: "T", password: "motdepasse-ok" }) });
  const s: S = { cookie: reg.headers.getSetCookie()[0].split(";")[0] };
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}
const iso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

describe("prospect simple ou à visiter en présentiel", () => {
  it("un lead est à visiter par défaut, et on peut le passer en prospect simple (à distance)", async () => {
    const s = await ceo();
    const lead = (await http(s, "POST", "/leads", { name: "Par défaut" })).json();
    expect(lead.visitMode).toBe("onsite");
    const patched = (await http(s, "PATCH", `/leads/${lead.id}`, { visitMode: "remote" })).json();
    expect(patched.visitMode).toBe("remote");
    expect((await http(s, "PATCH", `/leads/${lead.id}`, { visitMode: "visio" })).status).toBe(400);
  });

  it("une vague ne compte comme visites à faire que les prospects en présentiel", async () => {
    const s = await ceo();
    const region = (await http(s, "POST", "/regions", { name: "Cotonou", lat: 6.37, lng: 2.39, radiusKm: 10 })).json();
    await http(s, "POST", "/leads", { name: "En présentiel", lat: 6.37, lng: 2.39 });
    await http(s, "POST", "/leads", { name: "À distance", lat: 6.37, lng: 2.39, visitMode: "remote" });
    const wave = (await http(s, "POST", "/waves", { regionId: region.id, name: "S1", startsOn: iso(-1), endsOn: iso(5), targetVisits: 2 })).json();
    expect(wave.stats).toMatchObject({ total: 1, visited: 0, toRevisit: 1 });
    const revisit = (await http(s, "GET", `/waves/${wave.id}/revisit`)).json() as { name: string }[];
    expect(revisit.map((l) => l.name)).toEqual(["En présentiel"]);
  });
});
