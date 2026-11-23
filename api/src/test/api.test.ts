import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { client } from "../db/index.js";

let app: FastifyInstance;
let base = "";

type InjectOpts = { method?: string; url: string; payload?: unknown; headers?: Record<string, string> };

/** Vrais appels HTTP (light-my-request ne charge pas `cookie` en ESM sous Node 21). */
async function inject(o: InjectOpts) {
  const res = await fetch(base + o.url, {
    method: o.method ?? "GET",
    redirect: "manual",
    headers: { ...(o.payload !== undefined ? { "content-type": "application/json" } : {}), ...o.headers },
    body: o.payload !== undefined ? JSON.stringify(o.payload) : undefined,
  });
  const text = await res.text();
  const cookies = res.headers.getSetCookie().map((c) => {
    const [nv, ...attrs] = c.split(";").map((x) => x.trim());
    const [name, ...v] = nv.split("=");
    const attr = (k: string) => attrs.find((a) => a.toLowerCase().startsWith(k.toLowerCase()));
    return {
      name,
      value: v.join("="),
      httpOnly: !!attr("httponly"),
      sameSite: attr("samesite=")?.split("=")[1],
    };
  });
  return {
    statusCode: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    cookies,
    json: () => JSON.parse(text),
  };
}

beforeAll(async () => {
  app = await buildApp({ logger: false });
  base = await app.listen({ port: 0, host: "127.0.0.1" });
});
afterAll(async () => {
  await app.close();
  await client.end();
});

const run = Math.random().toString(36).slice(2, 8);
let n = 0;
const uniq = (p: string) => `${p}-${run}-${n++}@test.dev`;

type Session = { cookie: string; companyId?: string };

async function register(email = uniq("u"), password = "motdepasse-ok"): Promise<Session & { email: string }> {
  const res = await inject({ method: "POST", url: "/auth/register", payload: { email, name: "Test", password } });
  expect(res.statusCode).toBe(201);
  const c = res.cookies.find((x) => x.name === "harvest_session")!;
  return { cookie: `harvest_session=${c.value}`, email };
}
const call = (s: Session, method: any, url: string, payload?: unknown) =>
  inject({
    method,
    url,
    payload: payload as any,
    headers: { cookie: s.cookie, ...(s.companyId ? { "x-company-id": s.companyId } : {}) },
  });

async function onboard(s: Session, name = "Acme") {
  const res = await call(s, "POST", "/companies", { name, sector: "Restauration", region: "Cotonou", teamName: "Équipe 1" });
  expect(res.statusCode).toBe(201);
  s.companyId = res.json().company.id;
  return res.json();
}
const rolesByKey = async (s: Session) =>
  Object.fromEntries((await call(s, "GET", "/roles")).json().map((r: any) => [r.key, r]));

describe("auth e-mail", () => {
  it("inscrit, connecte, déconnecte", async () => {
    const { email } = await register();
    const bad = await inject({ method: "POST", url: "/auth/login", payload: { email, password: "mauvais-mdp" } });
    expect(bad.statusCode).toBe(401);
    const ghost = await inject({ method: "POST", url: "/auth/login", payload: { email: uniq("x"), password: "whatever12" } });
    expect(ghost.statusCode).toBe(401);
    expect(ghost.json()).toEqual(bad.json());
    const ok = await inject({ method: "POST", url: "/auth/login", payload: { email, password: "motdepasse-ok" } });
    expect(ok.statusCode).toBe(200);
    const cookie = `harvest_session=${ok.cookies[0].value}`;
    expect((await call({ cookie }, "GET", "/me")).statusCode).toBe(200);
    await call({ cookie }, "POST", "/auth/logout");
    expect((await call({ cookie }, "GET", "/me")).statusCode).toBe(401);
  });

  it("refuse un e-mail déjà pris et un mot de passe trop court", async () => {
    const { email } = await register();
    const dup = await inject({ method: "POST", url: "/auth/register", payload: { email, name: "x", password: "motdepasse-ok" } });
    expect(dup.statusCode).toBe(409);
    const short = await inject({ method: "POST", url: "/auth/register", payload: { email: uniq("s"), name: "x", password: "abc" } });
    expect(short.statusCode).toBe(400);
  });

  it("le cookie de session est httpOnly", async () => {
    const res = await inject({ method: "POST", url: "/auth/register", payload: { email: uniq("h"), name: "x", password: "motdepasse-ok" } });
    expect(res.cookies[0].httpOnly).toBe(true);
    expect(res.cookies[0].sameSite).toBe("Lax");
  });

  it("OAuth non configuré : redirige vers /login avec une erreur, sans fuite", async () => {
    const res = await inject({ method: "GET", url: "/auth/google" });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("/login?error=provider_not_configured");
    expect((await inject({ method: "GET", url: "/auth/google/callback?code=x&state=y" })).headers.location).toContain(
      "error=oauth_state",
    );
    expect((await inject({ method: "GET", url: "/auth/inconnu" })).statusCode).toBe(404);
  });

  it("returnTo hors liste blanche est ignoré", async () => {
    const res = await inject({ method: "GET", url: "/auth/google?returnTo=https://evil.example" });
    expect(res.headers.location).not.toContain("evil.example");
  });
});

describe("onboarding", () => {
  it("un nouveau compte n'a aucune entreprise, puis en crée une dont il est CEO", async () => {
    const s = await register();
    expect((await call(s, "GET", "/me")).json().memberships).toEqual([]);
    const { company, team } = await onboard(s);
    const me = (await call(s, "GET", "/me")).json();
    expect(me.memberships).toHaveLength(1);
    expect(me.memberships[0].company.id).toBe(company.id);
    expect(me.memberships[0].teamId).toBe(team.id);
    expect(me.memberships[0].permissions.find((p: any) => p.permission === "company:delete")).toBeTruthy();
    const r = await rolesByKey(s);
    expect(Object.keys(r).sort()).toEqual(["affilie", "ceo", "manager", "prospecteur", "worker"]);
  });

  it("exige l'authentification", async () => {
    expect((await inject({ method: "POST", url: "/companies", payload: {} })).statusCode).toBe(401);
  });
});

describe("isolation entre entreprises", () => {
  it("un CEO ne voit ni n'agit sur une autre entreprise", async () => {
    const a = await register();
    const b = await register();
    await onboard(a, "A");
    await onboard(b, "B");
    const forged = { cookie: a.cookie, companyId: b.companyId };
    expect((await call(forged, "GET", "/roles")).statusCode).toBe(403);
    expect((await call(forged, "GET", "/members")).statusCode).toBe(403);
    // un id de rôle d'une autre entreprise est introuvable
    const bRoles = await rolesByKey(b);
    expect((await call(a, "PATCH", `/roles/${bRoles.worker.id}`, { description: "pwned" })).statusCode).toBe(404);
    expect((await call(a, "DELETE", `/roles/${bRoles.worker.id}`)).statusCode).toBe(404);
  });
});

describe("RBAC", () => {
  async function setup() {
    const ceo = await register();
    await onboard(ceo);
    const r = await rolesByKey(ceo);
    const add = async (roleKey: string | string[]) => {
      const u = await register();
      const res = await call(ceo, "POST", "/members", { email: u.email, roleIds: [roleKey].flat().map((k) => r[k].id) });
      expect(res.statusCode).toBe(201);
      return { ...u, companyId: ceo.companyId, membershipId: res.json().id } as Session & { membershipId: string };
    };
    return { ceo, r, add };
  }

  it("le CEO ajoute des membres avec les rôles du cahier", async () => {
    const { ceo, add } = await setup();
    const worker = await add("worker");
    const list = (await call(ceo, "GET", "/members")).json();
    expect(list).toHaveLength(2);
    expect((await call(worker, "GET", "/me")).json().memberships[0].permissions.some((p: any) => p.permission === "lead:read")).toBe(true);
  });

  it("un taffeur ne gère ni les rôles ni les membres", async () => {
    const { add } = await setup();
    const w = await add("worker");
    expect((await call(w, "GET", "/roles")).statusCode).toBe(403);
    expect((await call(w, "POST", "/members", { email: "a@b.co", roleIds: [crypto.randomUUID()] })).statusCode).toBe(403);
  });

  it("un affilié n'a que ses droits (lead own, finance own)", async () => {
    const { add } = await setup();
    const a = await add("affilie");
    const perms = (await call(a, "GET", "/me")).json().memberships[0].permissions;
    expect(Object.fromEntries(perms.map((p: any) => [p.permission, p.scope]))).toEqual({
      "lead:create": "company",
      "lead:read": "own",
      "finance:read": "own",
    });
  });

  it("un manager ne peut pas se faire CEO ni promouvoir quelqu'un CEO (anti-escalade)", async () => {
    const { r, add } = await setup();
    const mgr = await add("manager");
    const w = await add("worker");
    const up = await call(mgr, "PUT", `/members/${w.membershipId}/roles`, { roleIds: [r.ceo.id] });
    expect(up.statusCode).toBe(403);
    const self = await call(mgr, "PUT", `/members/${mgr.membershipId}/roles`, { roleIds: [r.ceo.id] });
    expect(self.statusCode).toBe(403);
    // …mais il peut gérer les rôles inférieurs
    const ok = await call(mgr, "PUT", `/members/${w.membershipId}/roles`, { roleIds: [r.prospecteur.id] });
    expect(ok.statusCode).toBe(200);
  });

  it("un manager ne peut pas rétrograder ni retirer le CEO", async () => {
    const { ceo, r, add } = await setup();
    const mgr = await add("manager");
    const ceoMember = (await call(ceo, "GET", "/members")).json().find((m: any) => m.roleIds.includes(r.ceo.id));
    expect((await call(mgr, "PUT", `/members/${ceoMember.id}/roles`, { roleIds: [r.worker.id] })).statusCode).toBe(403);
    expect((await call(mgr, "DELETE", `/members/${ceoMember.id}`)).statusCode).toBe(403);
  });

  it("le dernier CEO ne peut pas être retiré ni rétrogradé", async () => {
    const { ceo, r } = await setup();
    const me = (await call(ceo, "GET", "/members")).json()[0];
    expect((await call(ceo, "PUT", `/members/${me.id}/roles`, { roleIds: [r.worker.id] })).statusCode).toBe(409);
    expect((await call(ceo, "DELETE", `/members/${me.id}`)).statusCode).toBe(409);
  });

  it("rôle personnalisé : composition de droits, plusieurs rôles cumulés", async () => {
    const { ceo, add } = await setup();
    const created = await call(ceo, "POST", "/roles", {
      name: "Comptable",
      grants: [
        { permission: "finance:read", scope: "company" },
        { permission: "finance:update", scope: "team" },
        { permission: "role:read", scope: "own" }, // portée ignorée : droit non scopé
      ],
    });
    expect(created.statusCode).toBe(201);
    const custom = created.json();
    expect(custom.grants.find((g: any) => g.permission === "role:read").scope).toBe("company");

    const u = await register();
    const res = await call(ceo, "POST", "/members", {
      email: u.email,
      roleIds: [custom.id, (await rolesByKey(ceo)).prospecteur.id],
    });
    expect(res.statusCode).toBe(201);
    const perms = Object.fromEntries(
      (await call({ cookie: u.cookie, companyId: ceo.companyId }, "GET", "/me")).json().memberships[0].permissions.map((p: any) => [p.permission, p.scope]),
    );
    expect(perms["finance:read"]).toBe("company"); // du rôle custom
    expect(perms["lead:create"]).toBe("company"); // du prospecteur
    expect(perms["lead:read"]).toBe("own");
    expect(perms["lead:delete"]).toBeUndefined();
    void add;
  });

  it("refuse permissions inconnues et rôle en cours d'usage à la suppression", async () => {
    const { ceo, r, add } = await setup();
    const bad = await call(ceo, "POST", "/roles", { name: "X", grants: [{ permission: "lead:explode", scope: "own" }] });
    expect(bad.statusCode).toBe(400);
    const c = (await call(ceo, "POST", "/roles", { name: "Temp", grants: [{ permission: "lead:read", scope: "own" }] })).json();
    const u = await register();
    await call(ceo, "POST", "/members", { email: u.email, roleIds: [c.id] });
    expect((await call(ceo, "DELETE", `/roles/${c.id}`)).statusCode).toBe(409);
    expect((await call(ceo, "DELETE", `/roles/${r.worker.id}`)).statusCode).toBe(403); // rôle système
    void add;
  });

  it("le CEO ne peut pas modifier le rôle CEO ; reset restaure le modèle", async () => {
    const { ceo, r } = await setup();
    expect((await call(ceo, "PATCH", `/roles/${r.ceo.id}`, { grants: [] })).statusCode).toBe(403);
    await call(ceo, "PATCH", `/roles/${r.worker.id}`, { grants: [{ permission: "lead:read", scope: "own" }] });
    const reset = await call(ceo, "POST", `/roles/${r.worker.id}/reset`);
    expect(reset.statusCode).toBe(200);
    expect(reset.json().grants.length).toBeGreaterThan(1);
  });

  it("un rôle custom avec role:update ne peut pas accorder plus que ce qu'il a", async () => {
    const { ceo, add } = await setup();
    const c = (
      await call(ceo, "POST", "/roles", {
        name: "Admin rôles",
        grants: [
          { permission: "role:create", scope: "company" },
          { permission: "role:read", scope: "company" },
          { permission: "lead:read", scope: "own" },
        ],
      })
    ).json();
    const u = await register();
    await call(ceo, "POST", "/members", { email: u.email, roleIds: [c.id] });
    const s = { cookie: u.cookie, companyId: ceo.companyId };
    const esc = await call(s, "POST", "/roles", { name: "Super", grants: [{ permission: "company:delete", scope: "company" }] });
    expect(esc.statusCode).toBe(403);
    const wide = await call(s, "POST", "/roles", { name: "Large", grants: [{ permission: "lead:read", scope: "company" }] });
    expect(wide.statusCode).toBe(403);
    const ok = await call(s, "POST", "/roles", { name: "Petit", grants: [{ permission: "lead:read", scope: "own" }] });
    expect(ok.statusCode).toBe(201);
    void add;
  });
});
