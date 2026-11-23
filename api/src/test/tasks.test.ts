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
  const email = `task-${run}-${n++}@test.dev`;
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

const mk = (s: S, body: object) => http(s, "POST", "/tasks", body);
const list = async (s: S, q = "") => (await http(s, "GET", `/tasks${q}`)).json() as any[];
const me = async (s: S) => (await http(s, "GET", "/me")).json().user.id as string;
const inbox = async (s: S) => (await http(s, "GET", "/notifications")).json() as { items: any[]; unread: number };
const past = () => new Date(Date.now() - 3600_000).toISOString();
const future = () => new Date(Date.now() + 24 * 3600_000).toISOString();

describe("tâches : création et lecture", () => {
  it("crée une tâche pour soi, liée à un lead, avec échéance", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "Pharmacie");
    const r = await mk(ceo, { title: "Rappeler", dueAt: future(), leadId: lead.id });
    expect(r.status).toBe(201);
    expect(r.json()).toMatchObject({ title: "Rappeler", leadId: lead.id, doneAt: null });
    const [t] = await list(ceo);
    expect(t).toMatchObject({ title: "Rappeler", assigneeName: "Le CEO", leadName: "Pharmacie" });
  });

  it("valide titre, date, lead et assigné", async () => {
    const { ceo } = await setup();
    expect((await mk(ceo, {})).status).toBe(400);
    expect((await mk(ceo, { title: "  " })).status).toBe(400);
    expect((await mk(ceo, { title: "x".repeat(201) })).status).toBe(400);
    expect((await mk(ceo, { title: "x", dueAt: "demain" })).status).toBe(400);
    expect((await mk(ceo, { title: "x", leadId: crypto.randomUUID() })).status).toBe(400);
    expect((await mk(ceo, { title: "x", assigneeId: crypto.randomUUID() })).status).toBe(400);
    expect((await mk(ceo, { title: "sans échéance", dueAt: null })).status).toBe(201);
  });

  it("filtre open / overdue / done / lead ; les plus urgentes d'abord, sans échéance à la fin", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "L");
    await mk(ceo, { title: "sans date" });
    await mk(ceo, { title: "demain", dueAt: future() });
    await mk(ceo, { title: "en retard", dueAt: past(), leadId: lead.id });
    const fini = (await mk(ceo, { title: "fini", dueAt: past() })).json();
    await http(ceo, "PATCH", `/tasks/${fini.id}`, { done: true });
    expect((await list(ceo)).map((t) => t.title)).toEqual(["en retard", "demain", "sans date"]);
    expect((await list(ceo, "?status=overdue")).map((t) => t.title)).toEqual(["en retard"]);
    expect((await list(ceo, "?status=done")).map((t) => t.title)).toEqual(["fini"]);
    expect(await list(ceo, "?status=all")).toHaveLength(4);
    expect((await list(ceo, `?leadId=${lead.id}`)).map((t) => t.title)).toEqual(["en retard"]);
    expect((await http(ceo, "GET", "/tasks?status=nimporte")).status).toBe(400);
  });
});

describe("tâches : modifier, terminer, supprimer", () => {
  it("terminer fixe doneAt, rouvrir l'efface ; titre et échéance se modifient", async () => {
    const { ceo } = await setup();
    const t = (await mk(ceo, { title: "A" })).json();
    const done = (await http(ceo, "PATCH", `/tasks/${t.id}`, { done: true })).json();
    expect(done.doneAt).not.toBeNull();
    const again = (await http(ceo, "PATCH", `/tasks/${t.id}`, { done: true })).json();
    expect(again.doneAt).toBe(done.doneAt); // déjà terminée : la date ne bouge pas
    const reopened = (await http(ceo, "PATCH", `/tasks/${t.id}`, { done: false, title: "B", dueAt: future() })).json();
    expect(reopened).toMatchObject({ doneAt: null, title: "B" });
    expect(reopened.dueAt).not.toBeNull();
    expect((await http(ceo, "PATCH", `/tasks/${t.id}`, {})).status).toBe(400);
    expect((await http(ceo, "DELETE", `/tasks/${t.id}`)).status).toBe(204);
    expect(await list(ceo, "?status=all")).toEqual([]);
  });

  it("supprimer le lead supprime ses tâches", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "L");
    await mk(ceo, { title: "A", leadId: lead.id });
    await http(ceo, "DELETE", `/leads/${lead.id}`);
    expect(await list(ceo, "?status=all")).toEqual([]);
  });
});

describe("tâches : attribution et notifications", () => {
  it("le manager confie une tâche à un prospecteur : elle apparaît chez lui, avec une notification", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const r = await mk(ceo, { title: "Visiter Koffi", assigneeId: await me(p), dueAt: future() });
    expect(r.status).toBe(201);
    expect((await list(p)).map((t) => t.title)).toEqual(["Visiter Koffi"]);
    const box = await inbox(p);
    expect(box.unread).toBe(1);
    expect(box.items[0]).toMatchObject({ kind: "task_assigned", title: "Le CEO vous a confié : Visiter Koffi", readAt: null });
    expect((await inbox(ceo)).unread).toBe(0); // personne ne se notifie soi-même
  });

  it("réattribuer notifie la nouvelle personne ; la tâche change de portée", async () => {
    const { ceo, add } = await setup();
    const a = await add("prospecteur", "A");
    const b = await add("prospecteur", "B");
    const t = (await mk(ceo, { title: "T", assigneeId: await me(a) })).json();
    expect((await http(ceo, "PATCH", `/tasks/${t.id}`, { assigneeId: await me(b) })).status).toBe(200);
    expect(await list(a)).toEqual([]);
    expect(await list(b)).toHaveLength(1);
    expect((await inbox(b)).unread).toBe(1);
  });

  it("un prospecteur ne peut pas confier de tâche à quelqu'un d'autre ; il gère les siennes", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    expect((await mk(p, { title: "pour le CEO", assigneeId: await me(ceo) })).status).toBe(400);
    const mine = (await mk(p, { title: "la mienne" })).json();
    expect((await http(p, "PATCH", `/tasks/${mine.id}`, { done: true })).status).toBe(200);
    expect((await http(p, "DELETE", `/tasks/${mine.id}`)).status).toBe(204);
  });

  it("on ne confie pas une tâche à quelqu'un d'une autre entreprise", async () => {
    const a = await setup();
    const b = await setup();
    expect((await mk(a.ceo, { title: "x", assigneeId: await me(b.ceo) })).status).toBe(400);
  });
});

describe("tâches : droits et isolation", () => {
  it("un prospecteur ne voit ni ne touche les tâches des autres (introuvable)", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const t = (await mk(ceo, { title: "du CEO" })).json();
    expect(await list(p)).toEqual([]);
    expect((await http(p, "PATCH", `/tasks/${t.id}`, { done: true })).status).toBe(404);
    expect((await http(p, "DELETE", `/tasks/${t.id}`)).status).toBe(404);
  });

  it("le nom du lead n'est pas révélé à qui ne peut pas le lire", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const secret = await mkLead(ceo, "Lead du CEO");
    await mk(ceo, { title: "T", leadId: secret.id, assigneeId: await me(p) });
    const [t] = await list(p);
    expect(t.leadName).toBeNull();
    // et il ne peut pas lier une tâche à un lead qu'il ne voit pas
    expect((await mk(p, { title: "x", leadId: secret.id })).status).toBe(400);
  });

  it("l'affilié n'a aucun droit sur les tâches ; la connexion est exigée", async () => {
    const { add } = await setup();
    const a = await add("affilie");
    expect((await http(a, "GET", "/tasks")).status).toBe(403);
    expect((await mk(a, { title: "x" })).status).toBe(403);
    expect((await http(null, "GET", "/tasks")).status).toBe(401);
  });

  it("isolation entre entreprises", async () => {
    const a = await setup();
    const b = await setup();
    const t = (await mk(a.ceo, { title: "secret" })).json();
    expect(await list(b.ceo, "?status=all")).toEqual([]);
    expect((await http(b.ceo, "PATCH", `/tasks/${t.id}`, { title: "pwned" })).status).toBe(404);
    expect((await http(b.ceo, "DELETE", `/tasks/${t.id}`)).status).toBe(404);
    expect((await http(b.ceo, "PATCH", "/tasks/pas-un-uuid", { title: "x" })).status).toBe(404);
  });
});

describe("notifications", () => {
  it("marquer comme lues : une, ou toutes ; seulement les siennes", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const q = await add("prospecteur", "Autre");
    await mk(ceo, { title: "1", assigneeId: await me(p) });
    await mk(ceo, { title: "2", assigneeId: await me(p) });
    await mk(ceo, { title: "3", assigneeId: await me(q) });
    const box = await inbox(p);
    expect(box.unread).toBe(2);
    expect((await http(p, "POST", "/notifications/read", { ids: [box.items[0].id] })).status).toBe(204);
    expect((await inbox(p)).unread).toBe(1);
    // marquer la notification d'un autre ne fait rien
    const others = await inbox(q);
    await http(p, "POST", "/notifications/read", { ids: [others.items[0].id] });
    expect((await inbox(q)).unread).toBe(1);
    await http(p, "POST", "/notifications/read", {});
    expect((await inbox(p)).unread).toBe(0);
    expect((await http(p, "POST", "/notifications/read", { ids: ["nope"] })).status).toBe(400);
    expect((await http(null, "GET", "/notifications")).status).toBe(401);
  });
});
