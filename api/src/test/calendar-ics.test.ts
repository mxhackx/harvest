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
  return { status: res.status, type: res.headers.get("content-type"), text, json: () => (text ? JSON.parse(text) : null) };
}
async function ceo(): Promise<S> {
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `ics-${run}-${n++}@test.dev`, name: "T", password: "motdepasse-ok" }) });
  const s: S = { cookie: reg.headers.getSetCookie()[0].split(";")[0] };
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}
const at = (days: number, hour = 9) => new Date(Date.UTC(2030, 0, 1 + days, hour)).toISOString();

describe("rendez-vous : durée et export .ics", () => {
  it("la fin doit suivre le début, à la création comme à la modification", async () => {
    const s = await ceo();
    expect((await http(s, "POST", "/events", { title: "Visite", startsAt: at(0), endsAt: at(0, 8) })).status).toBe(400);
    const ok = (await http(s, "POST", "/events", { title: "Visite", startsAt: at(0), endsAt: at(0, 11) })).json();
    expect(ok.endsAt).toBe(at(0, 11));
    expect((await http(s, "PATCH", `/events/${ok.id}`, { endsAt: at(0, 8) })).status).toBe(400);
    expect((await http(s, "PATCH", `/events/${ok.id}`, { startsAt: at(0, 12) })).status).toBe(400); // le début dépasserait la fin enregistrée
    expect((await http(s, "PATCH", `/events/${ok.id}`, { endsAt: null })).json().endsAt).toBeNull();
  });

  it("exporte les rendez-vous de la période en .ics, avec le nom du lead", async () => {
    const s = await ceo();
    const lead = (await http(s, "POST", "/leads", { name: "Boulangerie" })).json();
    await http(s, "POST", "/events", { title: "Visite Soleil", startsAt: at(1), endsAt: at(1, 10), leadId: lead.id, notes: "Apporter le devis" });
    await http(s, "POST", "/events", { title: "Hors période", startsAt: at(400) });
    const res = await http(s, "GET", `/events/export.ics?from=${encodeURIComponent(at(0))}&to=${encodeURIComponent(at(30))}`);
    expect(res.status).toBe(200);
    expect(res.type).toContain("text/calendar");
    expect(res.text).toContain("SUMMARY:Visite Soleil");
    expect(res.text).toContain("DTEND:20300102T100000Z");
    expect(res.text).toContain("Lead : Boulangerie");
    expect(res.text).not.toContain("Hors période");
  });
});
