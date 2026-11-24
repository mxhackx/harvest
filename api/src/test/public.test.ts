import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { config } from "../config.js";
import { client } from "../db/index.js";
import { outbox } from "../mail/send.js";

let app: FastifyInstance;
let base = "";
beforeAll(async () => {
  app = await buildApp({ logger: false });
  base = await app.listen({ port: 0, host: "127.0.0.1" });
});
afterAll(async () => {
  config.supportEmail = "";
  await app.close();
  await client.end();
});

const post = (url: string, body: unknown) => fetch(base + url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const run = Math.random().toString(36).slice(2, 8);

describe("bulle de contact", () => {
  it("garde le message, et l'envoie au support avec l'adresse du visiteur en réponse quand le support est configuré", async () => {
    config.supportEmail = "support@test.dev";
    const before = outbox.length;
    const res = await post("/public/contact", { email: `Visiteur-${run}@Example.com`, message: "Comment importer un fichier CSV ?", page: "/docs/import" });
    expect(res.status).toBe(202);
    const rows = await client`select email, page from contact_messages where email = ${`visiteur-${run}@example.com`}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].page).toBe("/docs/import");
    const mail = outbox.slice(before).find((m) => m.to === "support@test.dev")!;
    expect(mail.replyTo).toBe(`visiteur-${run}@example.com`);
    expect(mail.text).toContain("Comment importer");
  });

  it("sans adresse de support, le message est quand même gardé ; un robot (champ piège) n'est pas gardé", async () => {
    config.supportEmail = "";
    const before = outbox.length;
    expect((await post("/public/contact", { email: `sans-${run}@example.com`, message: "Bonjour, une question." })).status).toBe(202);
    expect(outbox.length).toBe(before);
    expect(await client`select 1 from contact_messages where email = ${`sans-${run}@example.com`}`).toHaveLength(1);
    expect((await post("/public/contact", { email: `bot-${run}@example.com`, message: "Achetez maintenant", website: "http://spam" })).status).toBe(202);
    expect(await client`select 1 from contact_messages where email = ${`bot-${run}@example.com`}`).toHaveLength(0);
  });

  it("refuse une adresse invalide, un message trop court ou une page qui n'est pas de la documentation", async () => {
    expect((await post("/public/contact", { email: "pas-un-mail", message: "Bonjour ceci est long" })).status).toBe(400);
    expect((await post("/public/contact", { email: "a@b.co", message: "x" })).status).toBe(400);
    expect((await post("/public/contact", { email: "a@b.co", message: "Bonjour ceci est long", page: "/dashboard" })).status).toBe(400);
  });
});

describe("avis sur un article", () => {
  it("enregistre une note de 1 à 3 pour une page de la documentation, rien d'autre", async () => {
    expect((await post("/public/feedback", { page: `/docs/waves`, rating: 3 })).status).toBe(204);
    expect((await post("/public/feedback", { page: "/docs/waves", rating: 4 })).status).toBe(400);
    expect((await post("/public/feedback", { page: "/admin", rating: 1 })).status).toBe(400);
    expect((await post("/public/feedback", { page: "/docs/../secret", rating: 1 })).status).toBe(400);
  });
});
