import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { client } from "../db/index.js";
import { sign } from "../webhooks/deliver.js";

let app: FastifyInstance;
let base = "";
let receiver: Server;
let receiverUrl = "";
const received: { headers: Record<string, string | string[] | undefined>; body: string }[] = [];
let receiverStatus = 200;

beforeAll(async () => {
  receiver = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      res.statusCode = receiverStatus;
      res.end("ok");
    });
  });
  await new Promise<void>((r) => receiver.listen(0, "127.0.0.1", r));
  receiverUrl = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}/hook`;
  app = await buildApp({ logger: false });
  base = await app.listen({ port: 0, host: "127.0.0.1" });
});
afterAll(async () => {
  await app.close();
  receiver.close();
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
async function register(label: string): Promise<S> {
  const email = `wh-${label}-${run}-${n++}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: label, password: "motdepasse-ok" }) });
  return { cookie: reg.headers.getSetCookie()[0].split(";")[0], email };
}
async function ceo(): Promise<S> {
  const s = await register("ceo");
  s.companyId = (await http(s, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
  return s;
}
const waitFor = async (cond: () => boolean) => {
  for (let i = 0; i < 60 && !cond(); i++) await new Promise((r) => setTimeout(r, 50));
};

describe("webhooks", () => {
  it("envoie un événement signé quand un lead est créé, et la signature se vérifie avec le secret", async () => {
    const s = await ceo();
    const hook = (await http(s, "POST", "/webhooks", { url: receiverUrl, events: ["lead.created"] })).json();
    expect(hook.secret).toMatch(/^whsec_/);
    expect(JSON.stringify((await http(s, "GET", "/webhooks")).json())).not.toContain(hook.secret); // le secret ne ressort pas
    const before = received.length;
    await http(s, "POST", "/leads", { name: "Boulangerie Soleil" });
    await http(s, "POST", "/leads/00000000-0000-0000-0000-000000000000/emails", {}); // sans effet sur le webhook
    await waitFor(() => received.length > before);
    const hit = received[before];
    expect(hit.headers["x-hivation-event"]).toBe("lead.created");
    expect(hit.headers["x-hivation-signature"]).toBe(sign(hook.secret, hit.body));
    expect(JSON.parse(hit.body)).toMatchObject({ event: "lead.created", data: { name: "Boulangerie Soleil" } });
  });

  it("n'envoie que les événements demandés et propose un test (ping)", async () => {
    const s = await ceo();
    const hook = (await http(s, "POST", "/webhooks", { url: receiverUrl, events: ["wave.closed"] })).json();
    const before = received.length;
    await http(s, "POST", "/leads", { name: "Pas d'envoi" });
    await new Promise((r) => setTimeout(r, 300));
    expect(received.length).toBe(before);
    const ping = await http(s, "POST", `/webhooks/${hook.id}/test`);
    expect(ping.json()).toEqual({ status: 200 });
    expect(received[received.length - 1].headers["x-hivation-event"]).toBe("ping");
  });

  it("éteint un webhook après trop d'échecs de suite", async () => {
    const s = await ceo();
    const hook = (await http(s, "POST", "/webhooks", { url: receiverUrl, events: ["lead.updated"] })).json();
    const lead = (await http(s, "POST", "/leads", { name: "L" })).json();
    receiverStatus = 500;
    try {
      for (let i = 0; i < 10; i++) {
        const before = received.length;
        await http(s, "PATCH", `/leads/${lead.id}`, { city: `V${i}` });
        await waitFor(() => received.length > before);
      }
      await new Promise((r) => setTimeout(r, 200));
    } finally {
      receiverStatus = 200;
    }
    const [row] = (await http(s, "GET", "/webhooks")).json().filter((h: { id: string }) => h.id === hook.id);
    expect(row).toMatchObject({ active: false, lastStatus: 500 });
    expect(row.failures).toBeGreaterThanOrEqual(10);
  });

  it("refuse une adresse non https hors test, une liste d'événements vide, et réserve les webhooks au CEO", async () => {
    const s = await ceo();
    expect((await http(s, "POST", "/webhooks", { url: "ftp://exemple.fr/x", events: ["lead.created"] })).status).toBe(400);
    expect((await http(s, "POST", "/webhooks", { url: receiverUrl, events: [] })).status).toBe(400);
    expect((await http(s, "POST", "/webhooks", { url: receiverUrl, events: ["ping"] })).status).toBe(400); // « ping » n'est pas un abonnement
    const roles = Object.fromEntries((await http(s, "GET", "/roles")).json().map((r: { key: string; id: string }) => [r.key, r.id]));
    const manager = await register("manager");
    manager.companyId = s.companyId;
    await http(s, "POST", "/members", { email: manager.email, roleIds: [roles.manager] });
    expect((await http(manager, "GET", "/webhooks")).status).toBe(403);
    expect((await http(manager, "POST", "/webhooks", { url: receiverUrl, events: ["lead.created"] })).status).toBe(403);
  });
});
