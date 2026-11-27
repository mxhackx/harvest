import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { client, db } from "../db/index.js";
import { attachments, leads } from "../db/schema.js";
import { purgeAttachments } from "../storage/cleanup.js";
import { cleanName, sniff } from "../storage/files.js";
import { setStorage } from "../storage/index.js";

let app: FastifyInstance;
let base = "";
const objects = new Map<string, string>(); // chemin → premiers octets « déposés »
const removed: string[] = [];
beforeAll(async () => {
  setStorage({
    signUpload: async (p) => `https://stockage.test/${p}`,
    signDownload: async (p) => `https://stockage.test/${p}?jeton`,
    head: async (p) => (objects.has(p) ? { size: 1234, start: new TextEncoder().encode(objects.get(p)!) } : null),
    remove: async (paths) => void removed.push(...paths),
  });
  app = await buildApp({ logger: false });
  base = await app.listen({ port: 0, host: "127.0.0.1" });
});
afterAll(async () => {
  setStorage(undefined);
  await app.close();
  await client.end();
});

const run = Math.random().toString(36).slice(2, 8);
let cookie = "";
async function http(method: string, url: string, body?: unknown) {
  const res = await fetch(base + url, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), cookie }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, json: () => (text ? JSON.parse(text) : null) };
}

describe("pièces jointes", () => {
  it("reconnaît le type réel et nettoie les noms", () => {
    expect(sniff(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniff(new TextEncoder().encode("<script>alert(1)"))).toBeNull();
    expect(cleanName("../../etc/passwd")).toBe(".._.._etc_passwd");
  });

  it("envoie, vérifie, télécharge ; refuse un faux fichier ; retire les orphelins", async () => {
    const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `pj-${run}@test.dev`, name: "ceo", password: "motdepasse-ok" }) });
    cookie = reg.headers.getSetCookie()[0].split(";")[0];
    const companyId = (await http("POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" })).json().company.id;
    const lead = (await http("POST", "/leads", { name: "Café" })).json();
    const ask = (extra: object = {}) => http("POST", `/leads/${lead.id}/attachments`, { name: "devis.pdf", size: 1234, type: "application/pdf", ...extra });

    expect((await ask({ size: 50 * 1024 * 1024 + 1 })).status).toBe(400);
    expect((await ask({ type: "image/svg+xml" })).status).toBe(400);

    const first = (await ask()).json();
    const path = new URL(first.uploadUrl).pathname.slice(1);
    expect(path.startsWith(`${companyId}/${lead.id}/`)).toBe(true);
    expect((await http("POST", `/attachments/${first.id}/complete`, {})).status).toBe(409); // rien n'est arrivé
    expect((await http("GET", `/attachments/${first.id}/url`)).status).toBe(404);
    objects.set(path, "%PDF-1.7");
    expect((await http("POST", `/attachments/${first.id}/complete`, {})).status).toBe(200);
    expect((await http("GET", `/leads/${lead.id}/attachments`)).json().items).toHaveLength(1);
    expect((await http("GET", `/attachments/${first.id}/url`)).json().url).toContain(path);

    const fake = (await ask({ name: "faux.pdf" })).json();
    const fakePath = new URL(fake.uploadUrl).pathname.slice(1);
    objects.set(fakePath, "<html><script>");
    expect((await http("POST", `/attachments/${fake.id}/complete`, {})).status).toBe(400);
    expect(removed).toContain(fakePath);

    // le lead effacé pour de bon : le fichier est retiré du stockage au passage suivant
    await db.delete(leads).where(eq(leads.id, lead.id));
    await purgeAttachments();
    expect(removed).toContain(path);
    expect(await db.select().from(attachments).where(eq(attachments.id, first.id))).toEqual([]);
  });
});
