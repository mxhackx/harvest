import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { client, db } from "../db/index.js";
import { leads } from "../db/schema.js";
import { purgeExpiredTrash } from "../leads/trash.js";

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
  const reg = await fetch(base + "/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `trash-${run}-${n++}@test.dev`, name: "T", password: "motdepasse-ok" }),
  });
  const s: S = { cookie: reg.headers.getSetCookie()[0].split(";")[0] };
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}

describe("corbeille", () => {
  it("un lead supprimé disparaît partout (liste, tâches, contacts) et se restaure avec son contenu", async () => {
    const s = await ceo();
    const lead = (await http(s, "POST", "/leads", { name: "Boulangerie", contactName: "Awa" })).json();
    await http(s, "POST", "/tasks", { title: "Rappeler", leadId: lead.id });
    expect((await http(s, "DELETE", `/leads/${lead.id}`)).status).toBe(204);

    expect((await http(s, "GET", "/leads")).json()).toHaveLength(0);
    expect((await http(s, "GET", "/tasks")).json()).toHaveLength(0);
    expect((await http(s, "GET", "/contacts")).json().items).toHaveLength(0);
    expect((await http(s, "PATCH", `/leads/${lead.id}`, { city: "X" })).status).toBe(404);
    const trash = (await http(s, "GET", "/leads/trash")).json();
    expect(trash).toHaveLength(1);
    expect(trash[0]).toMatchObject({ id: lead.id, deletedByName: "T" });

    expect((await http(s, "POST", "/leads/trash/restore", { ids: [lead.id] })).json().affected).toBe(1);
    expect((await http(s, "GET", "/leads")).json()).toHaveLength(1);
    expect((await http(s, "GET", "/tasks")).json()).toHaveLength(1);
    expect((await http(s, "GET", "/contacts")).json().items).toHaveLength(1);
    expect((await http(s, "GET", "/leads/trash")).json()).toHaveLength(0);
  });

  it("restaurer un lead dont le nom a été repris le renumérote au lieu de créer un doublon", async () => {
    const s = await ceo();
    const first = (await http(s, "POST", "/leads", { name: "Pharmacie" })).json();
    await http(s, "DELETE", `/leads/${first.id}`);
    await http(s, "POST", "/leads", { name: "Pharmacie" });
    await http(s, "POST", "/leads/trash/restore", { ids: [first.id] });
    const names = (await http(s, "GET", "/leads")).json().map((l: { name: string }) => l.name).sort();
    expect(names).toEqual(["Pharmacie", "Pharmacie (1)"]);
  });

  it("l'effacement définitif ne touche que la corbeille, et la purge ne prend que les leads vieux de plus de 30 jours", async () => {
    const s = await ceo();
    const alive = (await http(s, "POST", "/leads", { name: "Vivant" })).json();
    const old = (await http(s, "POST", "/leads", { name: "Ancien" })).json();
    const recent = (await http(s, "POST", "/leads", { name: "Récent" })).json();
    await http(s, "DELETE", `/leads/${old.id}`);
    await http(s, "DELETE", `/leads/${recent.id}`);
    await db.update(leads).set({ deletedAt: new Date(Date.now() - 31 * 86_400_000) }).where(eq(leads.id, old.id));

    expect((await http(s, "POST", "/leads/trash/purge", { ids: [alive.id] })).json().affected).toBe(0); // pas dans la corbeille
    expect(await purgeExpiredTrash()).toBeGreaterThanOrEqual(1);
    const rows = await db.select({ id: leads.id }).from(leads).where(eq(leads.companyId, s.companyId!));
    expect(rows.map((r) => r.id).sort()).toEqual([alive.id, recent.id].sort());
    expect((await http(s, "POST", "/leads/trash/purge", { ids: [recent.id] })).json().affected).toBe(1);
  });
});
