import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { client } from "../db/index.js";
import { outbox } from "../mail/send.js";
import { sendDueReminders } from "../reminders/send.js";

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
  const email = `rem-${run}-${n++}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: "T", password: "motdepasse-ok" }) });
  const s: S = { cookie: reg.headers.getSetCookie()[0].split(";")[0], email };
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const mine = async (s: S) => (await http(s, "GET", "/notifications")).json().items as { kind: string; title: string }[];

describe("rappels", () => {
  it("une tâche qui arrive à échéance notifie et envoie un e-mail, une seule fois", async () => {
    const s = await ceo();
    await http(s, "POST", "/tasks", { title: "Rappeler Awa", dueAt: inMinutes(30) });
    await http(s, "POST", "/tasks", { title: "Plus tard", dueAt: inMinutes(300) });
    const before = outbox.length;
    await sendDueReminders();
    const items = await mine(s);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "task_due" });
    expect(items[0].title).toContain("Rappeler Awa");
    const mails = outbox.slice(before).filter((m) => m.to === s.email);
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe("Rappel : Rappeler Awa");

    await sendDueReminders(); // deuxième passage : rien de nouveau
    expect(await mine(s)).toHaveLength(1);
    expect(outbox.slice(before).filter((m) => m.to === s.email)).toHaveLength(1);
  });

  it("retient les rappels d'une tâche terminée ou d'un lead à la corbeille, et respecte le refus des e-mails", async () => {
    const s = await ceo();
    const done = (await http(s, "POST", "/tasks", { title: "Faite", dueAt: inMinutes(10) })).json();
    await http(s, "PATCH", `/tasks/${done.id}`, { done: true });
    const lead = (await http(s, "POST", "/leads", { name: "Supprimé" })).json();
    await http(s, "POST", "/tasks", { title: "Du lead supprimé", leadId: lead.id, dueAt: inMinutes(10) });
    await http(s, "DELETE", `/leads/${lead.id}`);
    await sendDueReminders();
    expect(await mine(s)).toHaveLength(0);

    expect((await http(s, "PATCH", "/me/preferences", { emailReminders: false })).status).toBe(204);
    await http(s, "POST", "/tasks", { title: "Sans e-mail", dueAt: inMinutes(10) });
    const before = outbox.length;
    await sendDueReminders();
    expect(await mine(s)).toHaveLength(1); // la notification reste
    expect(outbox.slice(before).filter((m) => m.to === s.email)).toHaveLength(0);
  });

  it("changer l'échéance remet le rappel en route", async () => {
    const s = await ceo();
    const t = (await http(s, "POST", "/tasks", { title: "Décalée", dueAt: inMinutes(20) })).json();
    await sendDueReminders();
    expect(await mine(s)).toHaveLength(1);
    await http(s, "PATCH", `/tasks/${t.id}`, { dueAt: inMinutes(40) });
    await sendDueReminders();
    expect(await mine(s)).toHaveLength(2);
  });
});
