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
  const email = `activity-${run}-${n++}@test.dev`;
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

const feed = async (s: S, leadId: string, q = "") => (await http(s, "GET", `/leads/${leadId}/activities${q}`)).json() as { items: any[]; next: string | null };
const kinds = async (s: S, leadId: string) => (await feed(s, leadId)).items.map((a) => a.kind);

describe("fil d'activité : enregistrement automatique", () => {
  it("créer un lead écrit « créé » dans son fil, avec l'auteur et l'étape de départ", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "Pharmacie");
    const { items } = await feed(ceo, lead.id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "created", authorName: "Le CEO", meta: { source: "manual", stage: "À visiter" } });
  });

  it("changer d'étape écrit « de … à … » avec les noms du moment, et le motif de perte", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    await http(ceo, "PATCH", `/leads/${lead.id}`, { status: "interested" });
    await http(ceo, "PATCH", `/leads/${lead.id}`, { status: "lost", lostReason: "Trop cher" });
    const { items } = await feed(ceo, lead.id);
    expect(items.map((a) => a.kind)).toEqual(["stage_change", "stage_change", "created"]);
    expect(items[1].meta).toMatchObject({ from: { key: "to_visit", name: "À visiter" }, to: { key: "interested", name: "Intéressé" } });
    expect(items[0].meta).toMatchObject({ from: { key: "interested" }, to: { key: "lost", name: "Perdu" }, lostReason: "Trop cher" });
  });

  it("les noms d'étape du fil sont ceux de l'époque, même si l'étape est renommée ensuite", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    await http(ceo, "PATCH", `/leads/${lead.id}`, { status: "interested" });
    const stage = ((await http(ceo, "GET", "/stages")).json() as any[]).find((s) => s.key === "interested");
    await http(ceo, "PATCH", `/stages/${stage.id}`, { name: "Chaud" });
    expect((await feed(ceo, lead.id)).items[0].meta.to.name).toBe("Intéressé");
  });

  it("ne rien changer n'écrit rien (même étape, même état de visite)", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    await http(ceo, "PATCH", `/leads/${lead.id}`, { status: "to_visit", sector: "Santé" });
    await http(ceo, "PATCH", `/leads/${lead.id}`, { visited: false });
    expect(await kinds(ceo, lead.id)).toEqual(["created"]);
  });

  it("marquer visité puis remettre à visiter écrit chaque changement", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    await http(ceo, "PATCH", `/leads/${lead.id}`, { visited: true });
    await http(ceo, "PATCH", `/leads/${lead.id}`, { visited: false });
    const { items } = await feed(ceo, lead.id);
    expect(items.map((a) => [a.kind, a.meta?.visited])).toEqual([["visited", false], ["visited", true], ["created", undefined]]);
  });

  it("une action de masse écrit dans le fil de chaque lead réellement modifié", async () => {
    const { ceo } = await setup();
    const a = await mkLead(ceo, "A");
    const b = await mkLead(ceo, "B", { status: "interested" });
    await http(ceo, "POST", "/leads/bulk-update", { ids: [a.id, b.id], status: "interested", visited: true });
    // les deux changements sont écrits au même instant : leur ordre entre eux n'est pas garanti
    const ka = await kinds(ceo, a.id);
    expect(ka.slice(0, 2).sort()).toEqual(["stage_change", "visited"]);
    expect(ka[2]).toBe("created");
    expect((await kinds(ceo, b.id)).filter((k) => k === "stage_change")).toHaveLength(0); // déjà « intéressé » : rien à écrire
    expect((await kinds(ceo, b.id)).filter((k) => k === "visited")).toHaveLength(1);
  });

  it("l'import écrit « créé » (source import) pour chaque lead", async () => {
    const { ceo } = await setup();
    await http(ceo, "POST", "/leads/import", { content: "name\nA\nB", dryRun: false });
    for (const l of (await http(ceo, "GET", "/leads")).json() as any[]) {
      expect((await feed(ceo, l.id)).items[0]).toMatchObject({ kind: "created", meta: { source: "import" } });
    }
  });
});

describe("fil d'activité : saisies à la main", () => {
  it("note, appel, message, visite et e-mail s'ajoutent, du plus récent au plus ancien", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    for (const kind of ["note", "call", "message", "visit", "email"]) {
      const r = await http(ceo, "POST", `/leads/${lead.id}/activities`, { kind, body: `un ${kind}` });
      expect(r.status, kind).toBe(201);
      expect(r.json()).toMatchObject({ kind, body: `un ${kind}`, authorName: "Le CEO" });
    }
    expect((await kinds(ceo, lead.id)).slice(0, 5)).toEqual(["email", "visit", "message", "call", "note"]);
  });

  it("une date passée place l'entrée à la bonne place dans le fil ; le futur est refusé", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    await http(ceo, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: "récente" });
    const old = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    await http(ceo, "POST", `/leads/${lead.id}/activities`, { kind: "call", body: "appel d'il y a trois jours", occurredAt: old });
    const items = (await feed(ceo, lead.id)).items;
    expect(items.map((a) => a.body || a.kind)).toEqual(["récente", "created", "appel d'il y a trois jours"]);
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect((await http(ceo, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: "x", occurredAt: future })).status).toBe(400);
  });

  it("refuse les types système, un texte vide ou trop long", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    for (const kind of ["created", "stage_change", "visited", "assigned", "inconnu"]) {
      expect((await http(ceo, "POST", `/leads/${lead.id}/activities`, { kind, body: "x" })).status, kind).toBe(400);
    }
    expect((await http(ceo, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: "   " })).status).toBe(400);
    expect((await http(ceo, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: "x".repeat(2001) })).status).toBe(400);
    expect((await http(ceo, "POST", `/leads/${lead.id}/activities`, { kind: "note" })).status).toBe(400);
  });

  it("pagination : une page à la fois, `next` donne la date de la page suivante", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    for (let i = 1; i <= 5; i++) {
      await http(ceo, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: `n${i}`, occurredAt: new Date(Date.now() - (6 - i) * 60_000).toISOString() });
    }
    const first = await feed(ceo, lead.id, "?limit=3");
    expect(first.items.map((a) => a.body || a.kind)).toEqual(["created", "n5", "n4"]);
    expect(first.next).not.toBeNull();
    const second = await feed(ceo, lead.id, `?limit=3&before=${encodeURIComponent(first.next!)}`);
    expect(second.items.map((a) => a.body)).toEqual(["n3", "n2", "n1"]);
    expect(second.next).toBeNull();
    expect((await http(ceo, "GET", `/leads/${lead.id}/activities?limit=0`)).status).toBe(400);
    expect((await http(ceo, "GET", `/leads/${lead.id}/activities?limit=101`)).status).toBe(400);
  });
});

describe("fil d'activité : modifier et supprimer", () => {
  it("l'auteur modifie et supprime sa saisie", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    const note = (await http(ceo, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: "v1" })).json();
    expect((await http(ceo, "PATCH", `/activities/${note.id}`, { body: "v2" })).json().body).toBe("v2");
    expect((await http(ceo, "PATCH", `/activities/${note.id}`, {})).status).toBe(400);
    expect((await http(ceo, "DELETE", `/activities/${note.id}`)).status).toBe(204);
    expect(await kinds(ceo, lead.id)).toEqual(["created"]);
  });

  it("on ne modifie pas la saisie d'un autre, même avec tous les droits", async () => {
    const { ceo, add } = await setup();
    const manager = await add("manager", "Le manager");
    const lead = await mkLead(ceo, "X");
    const note = (await http(manager, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: "du manager" })).json();
    const r = await http(ceo, "PATCH", `/activities/${note.id}`, { body: "réécrit" });
    expect(r.status).toBe(403);
    expect(r.json().error).toBe("not_author");
    expect((await http(ceo, "DELETE", `/activities/${note.id}`)).status).toBe(403);
  });

  it("les événements du système sont intouchables", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    const created = (await feed(ceo, lead.id)).items[0];
    const r = await http(ceo, "PATCH", `/activities/${created.id}`, { body: "falsifié" });
    expect(r.status).toBe(403);
    expect(r.json().error).toBe("system_activity");
    expect((await http(ceo, "DELETE", `/activities/${created.id}`)).status).toBe(403);
  });
});

describe("fil d'activité : droits et isolation", () => {
  it("le fil suit les droits du lead : un prospecteur ne voit que celui de ses leads", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const mine = await mkLead(p, "Le mien");
    const theirs = await mkLead(ceo, "Celui du CEO");
    expect((await http(p, "GET", `/leads/${mine.id}/activities`)).status).toBe(200);
    expect((await http(p, "GET", `/leads/${theirs.id}/activities`)).status).toBe(404);
    expect((await http(p, "POST", `/leads/${theirs.id}/activities`, { kind: "note", body: "x" })).status).toBe(404);
  });

  it("un affilié lit le fil de son lead mais n'y écrit pas", async () => {
    const { add } = await setup();
    const a = await add("affilie");
    const lead = await mkLead(a, "Du affilié");
    expect((await http(a, "GET", `/leads/${lead.id}/activities`)).status).toBe(200);
    expect((await http(a, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: "x" })).status).toBe(403);
  });

  it("une saisie d'un lead devenu invisible reste introuvable pour le prospecteur qui l'a écrite", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const lead = await mkLead(p, "X");
    const note = (await http(p, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: "mienne" })).json();
    // le CEO s'approprie le lead : le prospecteur ne le voit plus
    await http(ceo, "DELETE", `/leads/${lead.id}`);
    expect((await http(p, "PATCH", `/activities/${note.id}`, { body: "x" })).status).toBe(404);
  });

  it("isolation entre entreprises", async () => {
    const a = await setup();
    const b = await setup();
    const lead = await mkLead(a.ceo, "Secret");
    const note = (await http(a.ceo, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: "secret" })).json();
    expect((await http(b.ceo, "GET", `/leads/${lead.id}/activities`)).status).toBe(404);
    expect((await http(b.ceo, "POST", `/leads/${lead.id}/activities`, { kind: "note", body: "pwned" })).status).toBe(404);
    expect((await http(b.ceo, "PATCH", `/activities/${note.id}`, { body: "pwned" })).status).toBe(404);
    expect((await http(b.ceo, "DELETE", `/activities/${note.id}`)).status).toBe(404);
    expect((await http(b.ceo, "PATCH", "/activities/pas-un-uuid", { body: "x" })).status).toBe(404);
  });

  it("supprimer le lead supprime son fil ; la connexion est exigée", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    await http(ceo, "DELETE", `/leads/${lead.id}`);
    expect((await http(ceo, "GET", `/leads/${lead.id}/activities`)).status).toBe(404);
    expect((await http(null, "GET", `/leads/${lead.id}/activities`)).status).toBe(401);
  });
});
