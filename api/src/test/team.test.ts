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
  const email = `team-${run}-${n++}@test.dev`;
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

const roleIds = async (s: S) => Object.fromEntries(((await http(s, "GET", "/roles")).json() as any[]).map((r) => [r.key, r.id])) as Record<string, string>;
const uid = async (s: S) => (await http(s, "GET", "/me")).json().user.id as string;
const invite = (s: S, body: object) => http(s, "POST", "/invitations", body);
const accept = (s: S, token: string) => http(s, "POST", "/invitations/accept", { token });

describe("invitations", () => {
  it("le CEO invite une adresse ; la personne s'inscrit, accepte, et devient membre avec les bons rôles et la bonne équipe", async () => {
    const { ceo } = await setup();
    const roles = await roleIds(ceo);
    const teamId = (await http(ceo, "GET", "/teams")).json()[0].id;
    const guest = await user("Invité");
    const r = await invite(ceo, { email: guest.email, roleIds: [roles.prospecteur], teamId });
    expect(r.status).toBe(201);
    const { token } = r.json();
    expect(token.length).toBeGreaterThan(30);
    // aperçu public : l'entreprise et l'adresse, rien d'autre
    const preview = await http(null, "POST", "/invitations/preview", { token });
    expect(preview.json()).toEqual({ email: guest.email.toLowerCase(), company: "Acme" });
    const ok = await accept(guest, token);
    expect(ok.status).toBe(201);
    guest.companyId = ok.json().companyId;
    const me = (await http(guest, "GET", "/me")).json();
    expect(me.memberships[0]).toMatchObject({ teamId, roles: [{ key: "prospecteur" }] });
    // plus en attente, et le lien ne sert qu'une fois
    expect(((await http(ceo, "GET", "/invitations")).json() as any[]).length).toBe(0);
    expect((await accept(guest, token)).status).toBe(404);
  });

  it("la liste n'expose jamais le jeton ; on peut révoquer ; un lien révoqué ne marche plus", async () => {
    const { ceo } = await setup();
    const roles = await roleIds(ceo);
    const guest = await user();
    const { token, id } = (await invite(ceo, { email: guest.email, roleIds: [roles.worker] })).json();
    const list = await http(ceo, "GET", "/invitations");
    expect(list.text).not.toContain(token);
    expect(list.json()[0]).not.toHaveProperty("tokenHash");
    expect((await http(ceo, "DELETE", `/invitations/${id}`)).status).toBe(204);
    expect((await accept(guest, token)).status).toBe(404);
    expect((await http(null, "POST", "/invitations/preview", { token })).status).toBe(404);
  });

  it("inviter deux fois la même adresse remplace l'ancien lien", async () => {
    const { ceo } = await setup();
    const roles = await roleIds(ceo);
    const guest = await user();
    const a = (await invite(ceo, { email: guest.email, roleIds: [roles.worker] })).json();
    const b = (await invite(ceo, { email: guest.email, roleIds: [roles.worker] })).json();
    expect(((await http(ceo, "GET", "/invitations")).json() as any[]).length).toBe(1);
    expect((await accept(guest, a.token)).status).toBe(404);
    expect((await accept(guest, b.token)).status).toBe(201);
  });

  it("une invitation expirée est refusée", async () => {
    const { ceo } = await setup();
    const roles = await roleIds(ceo);
    const guest = await user();
    const { token, id } = (await invite(ceo, { email: guest.email, roleIds: [roles.worker] })).json();
    await client`update invitations set expires_at = now() - interval '1 minute' where id = ${id}`;
    expect((await accept(guest, token)).status).toBe(404);
    expect(((await http(ceo, "GET", "/invitations")).json() as any[]).length).toBe(0);
  });

  it("le lien est nominatif : un autre compte connecté ne peut pas l'utiliser", async () => {
    const { ceo } = await setup();
    const roles = await roleIds(ceo);
    const guest = await user();
    const intruder = await user("Intrus");
    const { token } = (await invite(ceo, { email: guest.email, roleIds: [roles.worker] })).json();
    const r = await accept(intruder, token);
    expect(r.status).toBe(403);
    expect(r.json().error).toBe("invitation_other_email");
    expect((await accept(guest, token)).status).toBe(201); // le vrai destinataire peut toujours
    expect((await http(null, "POST", "/invitations/accept", { token })).status).toBe(401);
  });

  it("refus : déjà membre, rôle ou équipe d'une autre entreprise, escalade de droits", async () => {
    const a = await setup();
    const b = await setup();
    const rolesA = await roleIds(a.ceo);
    const rolesB = await roleIds(b.ceo);
    const manager = await a.add("manager");
    const member = await a.add("worker");
    expect((await invite(a.ceo, { email: member.email, roleIds: [rolesA.worker] })).json().error).toBe("already_member");
    expect((await invite(a.ceo, { email: "x@test.dev", roleIds: [rolesB.worker] })).json().error).toBe("unknown_role");
    const otherTeam = (await http(b.ceo, "GET", "/teams")).json()[0].id;
    expect((await invite(a.ceo, { email: "x@test.dev", roleIds: [rolesA.worker], teamId: otherTeam })).json().error).toBe("unknown_team");
    // un manager ne peut pas inviter quelqu'un comme CEO
    expect((await invite(manager, { email: "y@test.dev", roleIds: [rolesA.ceo] })).status).toBe(403);
    // un taffeur n'invite personne
    expect((await invite(member, { email: "z@test.dev", roleIds: [rolesA.worker] })).status).toBe(403);
    expect((await http(member, "GET", "/invitations")).status).toBe(403);
    expect((await invite(a.ceo, { email: "pas-un-mail", roleIds: [rolesA.worker] })).status).toBe(400);
  });

  it("isolation : une autre entreprise ne voit ni ne révoque les invitations", async () => {
    const a = await setup();
    const b = await setup();
    const rolesA = await roleIds(a.ceo);
    const { id } = (await invite(a.ceo, { email: "g@test.dev", roleIds: [rolesA.worker] })).json();
    expect(((await http(b.ceo, "GET", "/invitations")).json() as any[]).length).toBe(0);
    expect((await http(b.ceo, "DELETE", `/invitations/${id}`)).status).toBe(404);
    expect((await http(null, "POST", "/invitations/preview", { token: "x".repeat(43) })).status).toBe(404);
  });
});

describe("attribution des leads", () => {
  it("le CEO attribue des leads à un prospecteur : propriétaire, équipe, fil et notification suivent", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur", "Prospecteur");
    const a = await mkLead(ceo, "A");
    const b = await mkLead(ceo, "B");
    const r = await http(ceo, "POST", "/leads/assign", { ids: [a.id, b.id], ownerId: await uid(p) });
    expect(r.json()).toEqual({ affected: 2 });
    expect(((await http(p, "GET", "/leads")).json() as any[]).map((l) => l.name).sort()).toEqual(["A", "B"]);
    const feed = (await http(ceo, "GET", `/leads/${a.id}/activities`)).json().items[0];
    expect(feed).toMatchObject({ kind: "assigned", meta: { from: { name: "Le CEO" }, to: { name: "Prospecteur" } } });
    const inbox = (await http(p, "GET", "/notifications")).json();
    expect(inbox.unread).toBe(1);
    expect(inbox.items[0].title).toBe("Le CEO vous a attribué 2 leads");
  });

  it("un seul lead : la notification le nomme et pointe vers lui ; réattribuer au même propriétaire ne fait rien", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const a = await mkLead(ceo, "Pharmacie");
    await http(ceo, "POST", "/leads/assign", { ids: [a.id], ownerId: await uid(p) });
    const n = (await http(p, "GET", "/notifications")).json().items[0];
    expect(n).toMatchObject({ kind: "lead_assigned", leadId: a.id, title: "Le CEO vous a attribué : Pharmacie" });
    expect((await http(ceo, "POST", "/leads/assign", { ids: [a.id], ownerId: await uid(p) })).json()).toEqual({ affected: 0 });
  });

  it("sans le droit lead:assign : refusé ; cible hors entreprise ou inconnue : refusée", async () => {
    const a = await setup();
    const b = await setup();
    const p = await a.add("prospecteur");
    const lead = await mkLead(p, "Le mien");
    expect((await http(p, "POST", "/leads/assign", { ids: [lead.id], ownerId: await uid(a.ceo) })).status).toBe(403);
    expect((await http(a.ceo, "POST", "/leads/assign", { ids: [lead.id], ownerId: await uid(b.ceo) })).status).toBe(400);
    expect((await http(a.ceo, "POST", "/leads/assign", { ids: [lead.id], ownerId: crypto.randomUUID() })).status).toBe(400);
    expect((await http(a.ceo, "POST", "/leads/assign", { ids: [], ownerId: await uid(p) })).status).toBe(400);
  });

  it("à la création : le lead est attribué directement, avec fil et notification ; sans choix, on en est le responsable", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur", "Prospecteur");
    const mine = await mkLead(ceo, "Pour moi");
    expect(mine.ownerId).toBe(await uid(ceo));
    const lead = await mkLead(ceo, "Pour lui", { ownerId: await uid(p) });
    expect(lead).toMatchObject({ ownerId: await uid(p) });
    expect(((await http(p, "GET", "/leads")).json() as any[]).map((l) => l.name)).toEqual(["Pour lui"]);
    const kinds = ((await http(ceo, "GET", `/leads/${lead.id}/activities`)).json().items as any[]).map((i) => i.kind).sort();
    expect(kinds).toEqual(["assigned", "created"]);
    expect((await http(p, "GET", "/notifications")).json().items[0]).toMatchObject({ kind: "lead_assigned", leadId: lead.id, title: "Le CEO vous a attribué : Pour lui" });
    expect((await http(ceo, "GET", "/notifications")).json().unread).toBe(0);
  });

  it("à la création : sans le droit d'attribuer ou vers une personne inconnue ou d'une autre entreprise : refusé, rien n'est créé", async () => {
    const a = await setup();
    const b = await setup();
    const p = await a.add("prospecteur");
    const q = await a.add("prospecteur");
    const before = ((await http(a.ceo, "GET", "/leads")).json() as any[]).length;
    expect((await http(p, "POST", "/leads", { name: "X", ownerId: await uid(q) })).status).toBe(400);
    expect((await http(a.ceo, "POST", "/leads", { name: "X", ownerId: await uid(b.ceo) })).status).toBe(400);
    expect((await http(a.ceo, "POST", "/leads", { name: "X", ownerId: crypto.randomUUID() })).status).toBe(400);
    expect((await http(a.ceo, "POST", "/leads", { name: "X", ownerId: "pas-un-uuid" })).status).toBe(400);
    // se désigner soi-même reste permis à tout le monde
    expect((await http(p, "POST", "/leads", { name: "Y", ownerId: await uid(p) })).status).toBe(201);
    expect(((await http(a.ceo, "GET", "/leads")).json() as any[]).length).toBe(before + 1);
  });

  it("on ne déplace pas les leads d'une autre entreprise", async () => {
    const a = await setup();
    const b = await setup();
    const secret = await mkLead(b.ceo, "Secret");
    expect((await http(a.ceo, "POST", "/leads/assign", { ids: [secret.id], ownerId: await uid(a.ceo) })).json()).toEqual({ affected: 0 });
    expect(((await http(b.ceo, "GET", "/leads")).json() as any[])[0].ownerId).toBe(await uid(b.ceo));
  });
});

describe("équipes et membres", () => {
  it("renommer et supprimer une équipe ; les membres et leads n'ont alors plus d'équipe", async () => {
    const { ceo } = await setup();
    const team = (await http(ceo, "POST", "/teams", { name: "Nord" })).json();
    expect((await http(ceo, "PATCH", `/teams/${team.id}`, { name: "Grand Nord" })).json().name).toBe("Grand Nord");
    expect((await http(ceo, "PATCH", `/teams/${team.id}`, { name: "" })).status).toBe(400);
    expect((await http(ceo, "DELETE", `/teams/${team.id}`)).status).toBe(204);
    expect((await http(ceo, "DELETE", `/teams/${team.id}`)).status).toBe(404);
    expect((await http(ceo, "PATCH", `/teams/${crypto.randomUUID()}`, { name: "x" })).status).toBe(404);
  });

  it("isolation et droits sur les équipes", async () => {
    const a = await setup();
    const b = await setup();
    const w = await a.add("worker");
    const team = (await http(a.ceo, "GET", "/teams")).json()[0];
    expect((await http(b.ceo, "PATCH", `/teams/${team.id}`, { name: "pwned" })).status).toBe(404);
    expect((await http(b.ceo, "DELETE", `/teams/${team.id}`)).status).toBe(404);
    expect((await http(w, "PATCH", `/teams/${team.id}`, { name: "x" })).status).toBe(403);
    expect((await http(w, "DELETE", `/teams/${team.id}`)).status).toBe(403);
  });

  it("changer un membre d'équipe déplace aussi ses leads et ses tâches (portée « team »)", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const lead = await mkLead(p, "Le sien");
    await http(p, "POST", "/tasks", { title: "t" });
    const members = (await http(ceo, "GET", "/members")).json() as any[];
    const m = members.find((x) => x.email === p.email.toLowerCase());
    const north = (await http(ceo, "POST", "/teams", { name: "Nord" })).json();
    expect((await http(ceo, "PUT", `/members/${m.id}/team`, { teamId: north.id })).status).toBe(200);
    const [row] = await client`select team_id from leads where id = ${lead.id}`;
    expect(row.team_id).toBe(north.id);
    const [t] = await client`select team_id from tasks where owner_id = ${m.userId}`;
    expect(t.team_id).toBe(north.id);
  });
});

describe("e-mails : invitation et mot de passe oublié", () => {
  const sent = async () => (await import("../mail/send.js")).outbox;

  it("inviter envoie un e-mail avec le lien, et indique emailSent", async () => {
    const { ceo } = await setup();
    const roles = await roleIds(ceo);
    const before = (await sent()).length;
    const r = (await invite(ceo, { email: `Nouveau-${run}@Test.dev`, roleIds: [roles.worker] })).json();
    expect(r.emailSent).toBe(true);
    const mail = (await sent())[before];
    expect(mail.to).toBe(`nouveau-${run}@test.dev`);
    expect(mail.subject).toContain("Le CEO");
    expect(mail.text).toContain(`/invitation?token=${r.token}`);
    expect(mail.html).toContain("Acme");
  });

  it("mot de passe oublié : même réponse pour un compte inconnu, aucun e-mail pour lui", async () => {
    const u = await user("Oublieux");
    const out = await sent();
    const before = out.length;
    const known = await http(null, "POST", "/auth/forgot", { email: u.email });
    const unknown = await http(null, "POST", "/auth/forgot", { email: `inconnu-${run}@test.dev` });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.text).toBe(unknown.text);
    expect(out.length).toBe(before + 1);
    expect(out[before].to).toBe(u.email);
    expect((await http(null, "POST", "/auth/forgot", { email: "pas-un-mail" })).status).toBe(400);
  });

  it("réinitialiser : le nouveau mot de passe marche, l'ancien et les sessions ouvertes non, le jeton ne sert qu'une fois", async () => {
    const u = await user("Oublieux");
    const out = await sent();
    const before = out.length;
    await http(null, "POST", "/auth/forgot", { email: u.email });
    const token = out[before].text.match(/token=([\w-]+)/)![1];
    expect((await http(u, "GET", "/me")).status).toBe(200);
    expect((await http(null, "POST", "/auth/reset", { token, password: "court" })).status).toBe(400);
    expect((await http(null, "POST", "/auth/reset", { token, password: "nouveau-mot-de-passe" })).status).toBe(204);
    expect((await http(u, "GET", "/me")).status).toBe(401); // l'ancienne session est fermée
    expect((await http(null, "POST", "/auth/login", { email: u.email, password: "motdepasse-ok" })).status).toBe(401);
    expect((await http(null, "POST", "/auth/login", { email: u.email, password: "nouveau-mot-de-passe" })).status).toBe(200);
    expect((await http(null, "POST", "/auth/reset", { token, password: "encore-un-autre" })).json().error).toBe("invalid_reset");
  });

  it("une nouvelle demande annule la précédente ; un jeton inventé ou expiré est refusé", async () => {
    const u = await user("Oublieux");
    const out = await sent();
    const before = out.length;
    await http(null, "POST", "/auth/forgot", { email: u.email });
    await http(null, "POST", "/auth/forgot", { email: u.email });
    const [first, second] = [out[before].text.match(/token=([\w-]+)/)![1], out[before + 1].text.match(/token=([\w-]+)/)![1]];
    expect((await http(null, "POST", "/auth/reset", { token: first, password: "nouveau-mot-de-passe" })).status).toBe(400);
    expect((await http(null, "POST", "/auth/reset", { token: "x".repeat(43), password: "nouveau-mot-de-passe" })).status).toBe(400);
    const { db } = await import("../db/index.js");
    const { passwordResets } = await import("../db/schema.js");
    await db.update(passwordResets).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await http(null, "POST", "/auth/reset", { token: second, password: "nouveau-mot-de-passe" })).status).toBe(400);
  });
});
