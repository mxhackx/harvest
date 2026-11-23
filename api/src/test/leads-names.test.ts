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
  return { status: res.status, json: () => JSON.parse(text), setCookie: res.headers.getSetCookie() };
}
async function user(): Promise<S> {
  const email = `names-${run}-${n++}@test.dev`;
  const r = await http(null, "POST", "/auth/register", { email, name: "T", password: "motdepasse-ok" });
  return { email, cookie: r.setCookie[0].split(";")[0] };
}
async function setup() {
  const ceo = await user();
  const c = await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" });
  ceo.companyId = c.json().company.id;
  const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: any) => [r.key, r.id]));
  const add = async (key: string) => {
    const u = await user();
    await http(ceo, "POST", "/members", { email: u.email, roleIds: [roles[key]] });
    u.companyId = ceo.companyId;
    return u;
  };
  return { ceo, add };
}
const create = async (s: S, name: string, extra = {}) => (await http(s, "POST", "/leads", { name, ...extra })).json();
const names = async (s: S) => ((await http(s, "GET", "/leads")).json() as any[]).map((l) => l.name).sort();

describe("numérotation des noms identiques", () => {
  it("à la création : le deuxième devient (1), le troisième (2)", async () => {
    const { ceo } = await setup();
    expect((await create(ceo, "Pharmacie")).name).toBe("Pharmacie");
    expect((await create(ceo, "Pharmacie")).name).toBe("Pharmacie (1)");
    expect((await create(ceo, "Pharmacie")).name).toBe("Pharmacie (2)");
    expect(await names(ceo)).toEqual(["Pharmacie", "Pharmacie (1)", "Pharmacie (2)"]);
  });

  it("ignore la casse et les espaces", async () => {
    const { ceo } = await setup();
    await create(ceo, "Salon Prestige");
    expect((await create(ceo, "  SALON PRESTIGE ")).name).toBe("SALON PRESTIGE (1)");
  });

  it("un nom déjà numéroté qui est pris repart de sa base", async () => {
    const { ceo } = await setup();
    await create(ceo, "Garage");
    await create(ceo, "Garage");
    expect((await create(ceo, "Garage (1)")).name).toBe("Garage (2)");
  });

  it("une entreprise n'influence jamais la numérotation d'une autre", async () => {
    const a = await setup();
    const b = await setup();
    await create(a.ceo, "Commun");
    expect((await create(b.ceo, "Commun")).name).toBe("Commun");
  });

  it("compte aussi les leads que l'utilisateur ne voit pas : deux leads n'ont jamais le même nom", async () => {
    const { ceo, add } = await setup();
    await create(ceo, "Du CEO");
    const p = await add("prospecteur"); // ne voit que ses propres leads
    expect((await create(p, "Du CEO")).name).toBe("Du CEO (1)");
  });

  it("n'est pas confondu par les caractères spéciaux de la recherche (% et _)", async () => {
    const { ceo } = await setup();
    await create(ceo, "100% Bio");
    await create(ceo, "A_B");
    expect((await create(ceo, "100% Bio")).name).toBe("100% Bio (1)");
    expect((await create(ceo, "AXB")).name).toBe("AXB"); // « _ » n'est pas un joker
    expect((await create(ceo, "A_B")).name).toBe("A_B (1)");
  });

  it("respecte la limite de 120 caractères", async () => {
    const { ceo } = await setup();
    const long = "x".repeat(120);
    await create(ceo, long);
    const second = await create(ceo, long);
    expect(second.name.length).toBeLessThanOrEqual(120);
    expect(second.name.endsWith(" (1)")).toBe(true);
  });
});

describe("numérotation à la modification", () => {
  it("renommer vers un nom pris numérote le lead", async () => {
    const { ceo } = await setup();
    await create(ceo, "Boulangerie");
    const other = await create(ceo, "Autre");
    const up = await http(ceo, "PATCH", `/leads/${other.id}`, { name: "Boulangerie" });
    expect(up.json().name).toBe("Boulangerie (1)");
  });

  it("un lead ne se compte pas lui-même : le renommer sans changer son nom ne le numérote pas", async () => {
    const { ceo } = await setup();
    const lead = await create(ceo, "Pharmacie");
    expect((await http(ceo, "PATCH", `/leads/${lead.id}`, { name: "Pharmacie", sector: "Santé" })).json().name).toBe("Pharmacie");
    expect((await http(ceo, "PATCH", `/leads/${lead.id}`, { name: "PHARMACIE" })).json().name).toBe("PHARMACIE"); // simple changement de casse
    expect((await http(ceo, "PATCH", `/leads/${lead.id}`, { sector: "Autre" })).json().name).toBe("PHARMACIE");
  });

  it("libérer un nom permet de le réutiliser sans numéro", async () => {
    const { ceo } = await setup();
    const first = await create(ceo, "Salon");
    await http(ceo, "PATCH", `/leads/${first.id}`, { name: "Salon renommé" });
    expect((await create(ceo, "Salon")).name).toBe("Salon");
  });
});

describe("numérotation à l'import", () => {
  const CSV = "name,address\nPharmacie,Rue 1\nPharmacie,Rue 2\nPharmacie,Rue 3\nBoulangerie,Rue 4";

  it("l'analyse montre les noms définitifs et combien de leads sont renumérotés", async () => {
    const { ceo } = await setup();
    const r = (await http(ceo, "POST", "/leads/import", { content: CSV })).json();
    expect(r).toMatchObject({ dryRun: true, valid: 4, renamed: 2, duplicates: 0 });
    expect(r.preview.map((p: any) => p.name)).toEqual(["Pharmacie", "Pharmacie (1)", "Pharmacie (2)", "Boulangerie"]);
  });

  it("l'import crée les leads sous leurs noms numérotés", async () => {
    const { ceo } = await setup();
    await http(ceo, "POST", "/leads/import", { content: CSV, dryRun: false });
    expect(await names(ceo)).toEqual(["Boulangerie", "Pharmacie", "Pharmacie (1)", "Pharmacie (2)"]);
  });

  it("tient compte des leads déjà présents", async () => {
    const { ceo } = await setup();
    await create(ceo, "Pharmacie");
    await create(ceo, "Pharmacie");
    const r = (await http(ceo, "POST", "/leads/import", { content: "name,address\nPharmacie,Rue 9", dryRun: false })).json();
    expect(r).toMatchObject({ imported: 1, renamed: 1 });
    expect(await names(ceo)).toContain("Pharmacie (2)");
  });

  it("réimporter le même fichier ne crée rien, même après numérotation (ce sont des doublons, pas des homonymes)", async () => {
    const { ceo } = await setup();
    await http(ceo, "POST", "/leads/import", { content: CSV, dryRun: false });
    const again = (await http(ceo, "POST", "/leads/import", { content: CSV, dryRun: false })).json();
    expect(again).toMatchObject({ imported: 0, duplicates: 4, renamed: 0 });
    expect(await names(ceo)).toHaveLength(4);
  });
});
