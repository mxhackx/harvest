import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { client } from "../db/index.js";
import { outbox } from "../mail/send.js";
import { textToHtml } from "../routes/emails.js";

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
async function ceo(): Promise<S> {
  const email = `mail-${run}-${n++}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: "Awa CEO", password: "motdepasse-ok" }) });
  const s: S = { cookie: reg.headers.getSetCookie()[0].split(";")[0], email };
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}

describe("textToHtml", () => {
  it("n'interprète aucun HTML du texte saisi", () => {
    expect(textToHtml("<script>alert(1)</script> & co")).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; co");
  });
});

describe("e-mail depuis le CRM", () => {
  it("envoie avec l'adresse de l'expéditeur en réponse, et laisse une trace dans le fil", async () => {
    const s = await ceo();
    const lead = (await http(s, "POST", "/leads", { name: "Boulangerie" })).json();
    const before = outbox.length;
    const sent = await http(s, "POST", `/leads/${lead.id}/emails`, { to: "Awa@Example.com", subject: "Devis", body: "Bonjour,\nvoici le devis." });
    expect(sent.status).toBe(201);
    const mail = outbox.slice(before).find((m) => m.to === "awa@example.com")!;
    expect(mail).toMatchObject({ subject: "Devis", replyTo: s.email });
    const feed = (await http(s, "GET", `/leads/${lead.id}/activities`)).json();
    expect(JSON.stringify(feed)).toContain("E-mail à awa@example.com — Devis");
  });

  it("refuse une adresse invalide, un lead inconnu ou un contact d'un autre lead", async () => {
    const s = await ceo();
    const lead = (await http(s, "POST", "/leads", { name: "L1" })).json();
    const other = (await http(s, "POST", "/leads", { name: "L2", contactName: "Autre" })).json();
    const [foreign] = (await http(s, "GET", `/leads/${other.id}/contacts`)).json();
    expect((await http(s, "POST", `/leads/${lead.id}/emails`, { to: "pas-un-mail", subject: "x", body: "x" })).status).toBe(400);
    expect((await http(s, "POST", `/leads/${lead.id}/emails`, { to: "a@b.co", subject: "x", body: "x", contactId: foreign.id })).status).toBe(400);
    expect((await http(s, "POST", `/leads/00000000-0000-0000-0000-000000000000/emails`, { to: "a@b.co", subject: "x", body: "x" })).status).toBe(404);
  });

  it("l'effacement RGPD d'un contact supprime aussi les e-mails qui lui ont été envoyés", async () => {
    const s = await ceo();
    const lead = (await http(s, "POST", "/leads", { name: "Pharmacie", contactName: "Koffi" })).json();
    const [contact] = (await http(s, "GET", `/leads/${lead.id}/contacts`)).json();
    await http(s, "PATCH", `/contacts/${contact.id}`, { email: "koffi@example.com" });
    await http(s, "POST", `/leads/${lead.id}/emails`, { to: "koffi@example.com", subject: "Bonjour", body: "Texte", contactId: contact.id });
    const exported = (await http(s, "GET", `/contacts/${contact.id}/export`)).json();
    expect(exported.emails).toHaveLength(1);
    await http(s, "POST", `/contacts/${contact.id}/erase`, { confirm: true });
    const rows = await client`select count(*)::int as n from email_log where lead_id = ${lead.id}`;
    expect(rows[0].n).toBe(0);
  });
});
