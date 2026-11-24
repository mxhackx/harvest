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
  const email = `dup-${label}-${run}-${n++}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: label, password: "motdepasse-ok" }) });
  return { cookie: reg.headers.getSetCookie()[0].split(";")[0], email };
}
async function ceo(): Promise<S> {
  const s = await register("ceo");
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}

describe("doublons", () => {
  it("repère les leads au même téléphone et les fusionne sans rien perdre", async () => {
    const s = await ceo();
    const keep = (await http(s, "POST", "/leads", { name: "Pharmacie du Port", phone: "+229 97 00 11 22", contactName: "Awa" })).json();
    const dup = (await http(s, "POST", "/leads", { name: "Pharma Port", phone: "229-97-00-11-22", city: "Cotonou", sector: "Santé", contactName: "Koffi", lat: 6.37, lng: 2.39 })).json();
    await http(s, "POST", "/leads", { name: "Sans rapport", phone: "+229 55 55 55 55" });
    await http(s, "POST", "/tasks", { title: "Rappeler", leadId: dup.id });

    const groups = (await http(s, "GET", "/leads/duplicates")).json();
    expect(groups).toHaveLength(1);
    expect(groups[0].leads.map((l: { name: string }) => l.name)).toEqual(["Pharmacie du Port", "Pharma Port"]);

    const merged = await http(s, "POST", "/leads/merge", { keepId: keep.id, mergeIds: [dup.id] });
    expect(merged.json()).toEqual({ kept: keep.id, merged: 1 });

    const all = (await http(s, "GET", "/leads")).json() as { id: string; name: string; city: string; sector: string; lat: number | null }[];
    expect(all.map((l) => l.name).sort()).toEqual(["Pharmacie du Port", "Sans rapport"]);
    const kept = all.find((l) => l.id === keep.id)!;
    expect(kept).toMatchObject({ city: "Cotonou", sector: "Santé", lat: 6.37 }); // champs vides complétés
    const people = (await http(s, "GET", `/leads/${keep.id}/contacts`)).json() as { name: string; isPrimary: boolean }[];
    expect(people.map((p) => p.name).sort()).toEqual(["Awa", "Koffi"]);
    expect(people.filter((p) => p.isPrimary)).toHaveLength(1);
    expect((await http(s, "GET", "/tasks")).json().map((t: { title: string; leadName: string }) => [t.title, t.leadName])).toEqual([["Rappeler", "Pharmacie du Port"]]);
    const feed = JSON.stringify((await http(s, "GET", `/leads/${keep.id}/activities`)).json());
    expect(feed).toContain("Fusion");
  });

  it("refuse de fusionner un lead avec lui-même ou un lead hors de sa portée", async () => {
    const s = await ceo();
    const a = (await http(s, "POST", "/leads", { name: "A" })).json();
    expect((await http(s, "POST", "/leads/merge", { keepId: a.id, mergeIds: [a.id] })).status).toBe(400);
    const stranger = await ceo();
    const foreign = (await http(stranger, "POST", "/leads", { name: "B" })).json();
    expect((await http(s, "POST", "/leads/merge", { keepId: a.id, mergeIds: [foreign.id] })).status).toBe(404);
  });
});
