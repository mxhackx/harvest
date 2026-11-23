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
  const email = `contact-${run}-${n++}@test.dev`;
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

const contactsOf = async (s: S, leadId: string) => (await http(s, "GET", `/leads/${leadId}/contacts`)).json() as any[];
const addContact = (s: S, leadId: string, body: object) => http(s, "POST", `/leads/${leadId}/contacts`, body);
const leadOf = async (s: S, id: string) => ((await http(s, "GET", "/leads")).json() as any[]).find((l) => l.id === id);

describe("contacts d'un lead", () => {
  it("le premier contact est le principal ; le nom du lead (contactName) le suit", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "Pharmacie");
    const r = await addContact(ceo, lead.id, { name: "Mme Adjovi", role: "Gérante", phone: "+229 97 00 11 22", email: "adjovi@pharmacie.bj", whatsapp: "+229 97 00-11 22" });
    expect(r.status).toBe(201);
    expect(r.json()).toMatchObject({ name: "Mme Adjovi", role: "Gérante", isPrimary: true, whatsapp: "+22997001122", email: "adjovi@pharmacie.bj" });
    expect((await leadOf(ceo, lead.id)).contactName).toBe("Mme Adjovi");
  });

  it("un deuxième contact n'est pas principal ; en désigner un autre démet le premier", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "Pharmacie");
    const a = (await addContact(ceo, lead.id, { name: "A" })).json();
    const b = (await addContact(ceo, lead.id, { name: "B" })).json();
    expect(b.isPrimary).toBe(false);
    const list = await contactsOf(ceo, lead.id);
    expect(list.map((c) => c.name)).toEqual(["A", "B"]); // le principal d'abord
    await http(ceo, "PATCH", `/contacts/${b.id}`, { isPrimary: true });
    const after = await contactsOf(ceo, lead.id);
    expect(after.map((c) => [c.name, c.isPrimary])).toEqual([["B", true], ["A", false]]);
    expect((await leadOf(ceo, lead.id)).contactName).toBe("B");
    void a;
  });

  it("on ne peut pas retirer le statut de principal : il faut en désigner un autre", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    const a = (await addContact(ceo, lead.id, { name: "A" })).json();
    const r = await http(ceo, "PATCH", `/contacts/${a.id}`, { isPrimary: false });
    expect(r.status).toBe(409);
    expect(r.json().error).toBe("primary_required");
  });

  it("supprimer le principal promeut le plus ancien des autres ; supprimer le dernier vide le nom", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    const a = (await addContact(ceo, lead.id, { name: "A" })).json();
    const b = (await addContact(ceo, lead.id, { name: "B" })).json();
    await addContact(ceo, lead.id, { name: "C" });
    expect((await http(ceo, "DELETE", `/contacts/${a.id}`)).status).toBe(204);
    const list = await contactsOf(ceo, lead.id);
    expect(list.map((c) => [c.name, c.isPrimary])).toEqual([["B", true], ["C", false]]);
    expect((await leadOf(ceo, lead.id)).contactName).toBe("B");
    await http(ceo, "DELETE", `/contacts/${b.id}`);
    await http(ceo, "DELETE", `/contacts/${list[1].id}`);
    expect(await contactsOf(ceo, lead.id)).toEqual([]);
    expect((await leadOf(ceo, lead.id)).contactName).toBe("");
  });

  it("modifier un contact met à jour ses champs, et le nom du lead si c'est le principal", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    const a = (await addContact(ceo, lead.id, { name: "A", phone: "111111" })).json();
    const up = await http(ceo, "PATCH", `/contacts/${a.id}`, { name: "Alice", role: "Comptable", phone: "222222" });
    expect(up.json()).toMatchObject({ name: "Alice", role: "Comptable", phone: "222222", isPrimary: true });
    expect((await leadOf(ceo, lead.id)).contactName).toBe("Alice");
  });

  it("valide les champs", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    expect((await addContact(ceo, lead.id, {})).status).toBe(400);
    expect((await addContact(ceo, lead.id, { name: "" })).status).toBe(400);
    expect((await addContact(ceo, lead.id, { name: "A", email: "pas-un-mail" })).status).toBe(400);
    expect((await addContact(ceo, lead.id, { name: "A", whatsapp: "abc" })).status).toBe(400);
    expect((await addContact(ceo, lead.id, { name: "x".repeat(101) })).status).toBe(400);
    expect((await addContact(ceo, lead.id, { name: "A", email: "" })).status).toBe(201); // e-mail facultatif
  });

  it("limite à 30 contacts par lead", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X");
    for (let i = 0; i < 30; i++) expect((await addContact(ceo, lead.id, { name: `C${i}` })).status).toBe(201);
    expect((await addContact(ceo, lead.id, { name: "de trop" })).json().error).toBe("too_many_contacts");
  });
});

describe("contacts et champ « contact » du lead", () => {
  it("créer un lead avec un contactName crée son contact principal", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X", { contactName: "Koffi" });
    expect(await contactsOf(ceo, lead.id)).toMatchObject([{ name: "Koffi", isPrimary: true }]);
  });

  it("modifier contactName renomme le contact principal ; le vider ne le supprime pas", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X", { contactName: "Koffi" });
    await http(ceo, "PATCH", `/leads/${lead.id}`, { contactName: "Kofi" });
    expect((await contactsOf(ceo, lead.id))[0].name).toBe("Kofi");
    await http(ceo, "PATCH", `/leads/${lead.id}`, { contactName: "" });
    expect((await contactsOf(ceo, lead.id))).toHaveLength(1);
    expect((await leadOf(ceo, lead.id)).contactName).toBe("Kofi");
  });

  it("l'import crée les contacts principaux", async () => {
    const { ceo } = await setup();
    await http(ceo, "POST", "/leads/import", { content: "name,contactName\nA,Awa\nB,", dryRun: false });
    const leads = (await http(ceo, "GET", "/leads")).json() as any[];
    const a = leads.find((l) => l.name === "A");
    const b = leads.find((l) => l.name === "B");
    expect(await contactsOf(ceo, a.id)).toMatchObject([{ name: "Awa", isPrimary: true }]);
    expect(await contactsOf(ceo, b.id)).toEqual([]);
  });

  it("supprimer le lead supprime ses contacts", async () => {
    const { ceo } = await setup();
    const lead = await mkLead(ceo, "X", { contactName: "Koffi" });
    await http(ceo, "DELETE", `/leads/${lead.id}`);
    expect((await http(ceo, "GET", `/leads/${lead.id}/contacts`)).status).toBe(404);
  });
});

describe("contacts : droits et isolation", () => {
  it("les contacts suivent les droits du lead : un prospecteur gère ceux de ses leads, pas ceux des autres", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    const mine = await mkLead(p, "Le mien");
    const theirs = await mkLead(ceo, "Celui du CEO", { contactName: "X" });
    expect((await addContact(p, mine.id, { name: "A" })).status).toBe(201);
    expect((await addContact(p, theirs.id, { name: "A" })).status).toBe(404); // hors de sa portée : introuvable
    expect((await http(p, "GET", `/leads/${theirs.id}/contacts`)).status).toBe(404);
    const theirContact = (await contactsOf(ceo, theirs.id))[0];
    expect((await http(p, "PATCH", `/contacts/${theirContact.id}`, { name: "pwned" })).status).toBe(404);
    expect((await http(p, "DELETE", `/contacts/${theirContact.id}`)).status).toBe(404);
  });

  it("un affilié lit les contacts de son lead mais ne les modifie pas (pas de droit lead:update)", async () => {
    const { add } = await setup();
    const a = await add("affilie");
    const lead = await mkLead(a, "Du affilié");
    expect((await http(a, "GET", `/leads/${lead.id}/contacts`)).status).toBe(200);
    expect((await addContact(a, lead.id, { name: "A" })).status).toBe(403);
  });

  it("isolation entre entreprises", async () => {
    const a = await setup();
    const b = await setup();
    const lead = await mkLead(a.ceo, "Secret", { contactName: "X" });
    const contact = (await contactsOf(a.ceo, lead.id))[0];
    expect((await http(b.ceo, "GET", `/leads/${lead.id}/contacts`)).status).toBe(404);
    expect((await addContact(b.ceo, lead.id, { name: "pwned" })).status).toBe(404);
    expect((await http(b.ceo, "PATCH", `/contacts/${contact.id}`, { name: "pwned" })).status).toBe(404);
    expect((await http(b.ceo, "DELETE", `/contacts/${contact.id}`)).status).toBe(404);
    expect((await http(b.ceo, "PATCH", "/contacts/pas-un-uuid", { name: "x" })).status).toBe(404);
    expect(await contactsOf(a.ceo, lead.id)).toHaveLength(1);
  });

  it("exige la connexion", async () => {
    expect((await http(null, "GET", `/leads/${crypto.randomUUID()}/contacts`)).status).toBe(401);
  });
});
