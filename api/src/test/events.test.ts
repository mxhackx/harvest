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
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(s ? { cookie: s.cookie, ...(s.companyId ? { "x-company-id": s.companyId } : {}) } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: () => JSON.parse(text), setCookie: res.headers.getSetCookie() };
}
async function user(): Promise<S> {
  const email = `event-${run}-${n++}@test.dev`;
  const r = await http(null, "POST", "/auth/register", { email, name: "T", password: "motdepasse-ok" });
  return { email, cookie: r.setCookie[0].split(";")[0] };
}
async function setup() {
  const ceo = await user();
  const c = await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "Cotonou", teamName: "T1" });
  ceo.companyId = c.json().company.id;
  const team1 = c.json().team.id;
  const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: any) => [r.key, r.id]));
  const add = async (key: string) => {
    const u = await user();
    expect((await http(ceo, "POST", "/members", { email: u.email, roleIds: [roles[key]], teamId: team1 })).status).toBe(201);
    u.companyId = ceo.companyId;
    return u;
  };
  return { ceo, add };
}

const DAY = "2026-11-24";
const at = (h: number) => `${DAY}T${String(h).padStart(2, "0")}:00:00.000Z`;
const WINDOW = `from=${encodeURIComponent("2026-11-01T00:00:00.000Z")}&to=${encodeURIComponent("2026-12-01T00:00:00.000Z")}`;
const list = async (s: S, q = WINDOW) => (await http(s, "GET", `/events?${q}`)).json();
const mk = (s: S, title: string, extra = {}) => http(s, "POST", "/events", { title, startsAt: at(9), ...extra });

describe("rendez-vous : création et lecture", () => {
  it("crée un rendez-vous et le retrouve, trié par heure", async () => {
    const { ceo } = await setup();
    const r = await mk(ceo, "Visite Boulangerie", { kind: "visit", notes: "Apporter la maquette", startsAt: at(14) });
    expect(r.status).toBe(201);
    expect(r.json()).toMatchObject({ title: "Visite Boulangerie", kind: "visit", done: false, notes: "Apporter la maquette", leadId: null });
    await mk(ceo, "Appel pharmacie", { kind: "call", startsAt: at(8) });
    const events = await list(ceo);
    expect(events.map((e: any) => e.title)).toEqual(["Appel pharmacie", "Visite Boulangerie"]);
  });

  it("l'heure est un instant : un décalage horaire est converti en UTC", async () => {
    const { ceo } = await setup();
    const e = (await mk(ceo, "Lomé", { startsAt: "2026-11-24T10:00:00+01:00" })).json();
    expect(e.startsAt).toBe("2026-11-24T09:00:00.000Z");
  });

  it("la période est semi-ouverte : début inclus, fin exclue", async () => {
    const { ceo } = await setup();
    await mk(ceo, "pile au début", { startsAt: "2026-11-24T00:00:00.000Z" });
    await mk(ceo, "pile à la fin", { startsAt: "2026-11-25T00:00:00.000Z" });
    const q = `from=${encodeURIComponent("2026-11-24T00:00:00.000Z")}&to=${encodeURIComponent("2026-11-25T00:00:00.000Z")}`;
    expect((await list(ceo, q)).map((e: any) => e.title)).toEqual(["pile au début"]);
  });

  it("valide les entrées", async () => {
    const { ceo } = await setup();
    expect((await http(ceo, "POST", "/events", { startsAt: at(9) })).status).toBe(400); // pas de titre
    expect((await http(ceo, "POST", "/events", { title: "x" })).status).toBe(400); // pas de date
    expect((await mk(ceo, "x", { startsAt: "demain" })).status).toBe(400);
    expect((await mk(ceo, "x", { kind: "réunion" })).status).toBe(400);
    expect((await mk(ceo, "")).status).toBe(400);
    expect((await mk(ceo, "x".repeat(121))).status).toBe(400);
  });

  it("valide la période demandée", async () => {
    const { ceo } = await setup();
    expect((await http(ceo, "GET", "/events")).status).toBe(400);
    expect((await http(ceo, "GET", `/events?from=${encodeURIComponent(at(9))}&to=${encodeURIComponent(at(8))}`)).status).toBe(400);
    const wide = `from=${encodeURIComponent("2026-01-01T00:00:00.000Z")}&to=${encodeURIComponent("2026-12-31T00:00:00.000Z")}`;
    expect((await http(ceo, "GET", `/events?${wide}`)).status).toBe(400);
  });

  it("exige la connexion", async () => {
    expect((await http(null, "GET", `/events?${WINDOW}`)).status).toBe(401);
    expect((await http(null, "POST", "/events", { title: "x", startsAt: at(9) })).status).toBe(401);
  });
});

describe("rendez-vous : lien avec un lead", () => {
  it("rattache un rendez-vous à un lead et affiche son nom", async () => {
    const { ceo } = await setup();
    const lead = (await http(ceo, "POST", "/leads", { name: "Pharmacie Étoile" })).json();
    const e = (await mk(ceo, "Visite", { leadId: lead.id })).json();
    expect(e.leadId).toBe(lead.id);
    expect((await list(ceo))[0].leadName).toBe("Pharmacie Étoile");
  });

  it("refuse un lead inexistant, d'une autre entreprise ou hors de sa portée", async () => {
    const a = await setup();
    const b = await setup();
    const foreign = (await http(b.ceo, "POST", "/leads", { name: "secret" })).json();
    expect((await mk(a.ceo, "x", { leadId: foreign.id })).status).toBe(400);
    expect((await mk(a.ceo, "x", { leadId: crypto.randomUUID() })).status).toBe(400);
    // un prospecteur ne voit que ses leads : il ne peut pas rattacher un rendez-vous à celui du CEO
    const p = await a.add("prospecteur");
    const ceoLead = (await http(a.ceo, "POST", "/leads", { name: "du CEO" })).json();
    expect((await mk(p, "x", { leadId: ceoLead.id })).status).toBe(400);
    const own = (await http(p, "POST", "/leads", { name: "à moi" })).json();
    expect((await mk(p, "ok", { leadId: own.id })).status).toBe(201);
  });

  it("supprimer le lead supprime ses rendez-vous", async () => {
    const { ceo } = await setup();
    const lead = (await http(ceo, "POST", "/leads", { name: "éphémère" })).json();
    await mk(ceo, "lié", { leadId: lead.id });
    await mk(ceo, "libre");
    await http(ceo, "DELETE", `/leads/${lead.id}`);
    expect((await list(ceo)).map((e: any) => e.title)).toEqual(["libre"]);
  });
});

describe("rendez-vous : droits et portée", () => {
  it("prospecteur et taffeur ne voient et ne modifient que leurs rendez-vous", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const w = await add("worker");
    const mine = (await mk(p, "du prospecteur")).json();
    await mk(w, "du taffeur");
    await mk(ceo, "du CEO");
    expect((await list(p)).map((e: any) => e.title)).toEqual(["du prospecteur"]);
    expect((await list(w)).map((e: any) => e.title)).toEqual(["du taffeur"]);
    expect(await list(ceo)).toHaveLength(3);
    const ceoEvent = (await list(ceo)).find((e: any) => e.title === "du CEO");
    // hors portée : introuvable, pas « interdit »
    expect((await http(p, "PATCH", `/events/${ceoEvent.id}`, { done: true })).status).toBe(404);
    expect((await http(p, "DELETE", `/events/${ceoEvent.id}`)).status).toBe(404);
    expect((await http(p, "PATCH", `/events/${mine.id}`, { done: true })).status).toBe(200);
  });

  it("le manager gère les rendez-vous de toute l'équipe", async () => {
    const { add } = await setup();
    const mgr = await add("manager");
    const p = await add("prospecteur");
    const e = (await mk(p, "à déplacer")).json();
    expect((await list(mgr)).map((x: any) => x.title)).toEqual(["à déplacer"]);
    const up = await http(mgr, "PATCH", `/events/${e.id}`, { startsAt: at(16) });
    expect(up.status).toBe(200);
    expect(up.json().startsAt).toBe(at(16));
    expect((await http(mgr, "DELETE", `/events/${e.id}`)).status).toBe(204);
  });

  it("l'affilié n'a pas de calendrier", async () => {
    const { add } = await setup();
    const a = await add("affilie");
    expect((await http(a, "GET", `/events?${WINDOW}`)).status).toBe(403);
    expect((await mk(a, "x")).status).toBe(403);
  });

  it("isolation : jamais les rendez-vous d'une autre entreprise", async () => {
    const a = await setup();
    const b = await setup();
    const e = (await mk(b.ceo, "secret")).json();
    expect(await list(a.ceo)).toEqual([]);
    expect((await http(a.ceo, "PATCH", `/events/${e.id}`, { title: "pwned" })).status).toBe(404);
    expect((await http(a.ceo, "DELETE", `/events/${e.id}`)).status).toBe(404);
    expect((await http({ ...a.ceo, companyId: b.ceo.companyId }, "GET", `/events?${WINDOW}`)).status).toBe(403);
    expect((await list(b.ceo))[0].title).toBe("secret");
  });

  it("un rôle personnalisé peut recevoir des droits calendrier limités", async () => {
    const { ceo } = await setup();
    const role = (
      await http(ceo, "POST", "/roles", {
        name: "Lecteur agenda",
        grants: [{ permission: "event:read", scope: "company" }],
      })
    ).json();
    const u = await user();
    await http(ceo, "POST", "/members", { email: u.email, roleIds: [role.id] });
    u.companyId = ceo.companyId;
    await mk(ceo, "visible");
    expect((await list(u)).map((e: any) => e.title)).toEqual(["visible"]);
    expect((await mk(u, "interdit")).status).toBe(403); // lecture seule
  });
});

describe("rendez-vous : modification et suppression", () => {
  it("modifie, marque comme fait, détache du lead, supprime", async () => {
    const { ceo } = await setup();
    const lead = (await http(ceo, "POST", "/leads", { name: "L" })).json();
    const e = (await mk(ceo, "Visite", { leadId: lead.id })).json();
    const done = await http(ceo, "PATCH", `/events/${e.id}`, { done: true, title: "Visite faite", notes: "ok" });
    expect(done.json()).toMatchObject({ done: true, title: "Visite faite", notes: "ok", leadId: lead.id });
    const detached = await http(ceo, "PATCH", `/events/${e.id}`, { leadId: null });
    expect(detached.json().leadId).toBeNull();
    expect((await http(ceo, "PATCH", `/events/${e.id}`, { title: "" })).status).toBe(400);
    expect((await http(ceo, "PATCH", `/events/${crypto.randomUUID()}`, { done: true })).status).toBe(404);
    expect((await http(ceo, "PATCH", "/events/pas-un-uuid", { done: true })).status).toBe(404);
    expect((await http(ceo, "DELETE", `/events/${e.id}`)).status).toBe(204);
    expect(await list(ceo)).toEqual([]);
  });
});

describe("/me : informations du profil", () => {
  it("renvoie l'entreprise, les rôles, l'équipe et la date d'arrivée", async () => {
    const { ceo, add } = await setup();
    const me = (await http(ceo, "GET", "/me")).json().memberships[0];
    expect(me.company.name).toBe("Acme");
    expect(me.roles.map((r: any) => r.key)).toEqual(["ceo"]);
    expect(me.roles[0].name).toBe("CEO");
    expect(me.team.name).toBe("T1");
    expect(new Date(me.joinedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
    const w = await add("worker");
    const wm = (await http(w, "GET", "/me")).json().memberships[0];
    expect(wm.roles.map((r: any) => r.name)).toEqual(["Taffeur"]);
  });

  it("un membre sans équipe a team = null", async () => {
    const { ceo } = await setup();
    const roles = (await http(ceo, "GET", "/roles")).json();
    const u = await user();
    await http(ceo, "POST", "/members", { email: u.email, roleIds: [roles.find((r: any) => r.key === "worker").id] });
    u.companyId = ceo.companyId;
    expect((await http(u, "GET", "/me")).json().memberships[0].team).toBeNull();
  });
});
