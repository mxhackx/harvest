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

const run = Math.random().toString(36).slice(2, 8);
async function http(cookie: string, method: string, url: string, body?: unknown) {
  const res = await fetch(base + url, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), cookie }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, json: () => (text ? JSON.parse(text) : null) };
}
async function register(label: string) {
  const email = `co-${label}-${run}@test.dev`;
  const reg = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: label, password: "motdepasse-ok" }) });
  return { email, cookie: reg.headers.getSetCookie()[0].split(";")[0] };
}

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("entreprise", () => {
  it("garde photo, e-mail et téléphone, refuse les valeurs invalides, et réserve la modification à qui en a le droit", async () => {
    const ceo = await register("ceo");
    await http(ceo.cookie, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1", email: "Contact@Acme.bj", phone: "+229 01 97 00 00 00", logo: PNG });
    const company = async (cookie: string) => (await http(cookie, "GET", "/me")).json().memberships[0].company;
    expect(await company(ceo.cookie)).toMatchObject({ email: "contact@acme.bj", phone: "+2290197000000", logo: PNG });

    for (const bad of [{ phone: "97000000" }, { email: "pas-une-adresse" }, { logo: "data:image/svg+xml;base64,PHN2Zz4=" }, { logo: "https://exemple.com/x.png" }, {}])
      expect((await http(ceo.cookie, "PATCH", "/company", bad)).status).toBe(400);
    expect((await http(ceo.cookie, "PATCH", "/company", { name: "Acme SARL", logo: "" })).status).toBe(200);
    expect(await company(ceo.cookie)).toMatchObject({ name: "Acme SARL", logo: "", phone: "+2290197000000" });

    const other = await register("membre");
    const roles = (await http(ceo.cookie, "GET", "/roles")).json() as { id: string; key: string }[];
    await http(ceo.cookie, "POST", "/members", { email: other.email, roleIds: [roles.find((r) => r.key === "manager")!.id] });
    expect((await http(other.cookie, "PATCH", "/company", { name: "Pirate" })).status).toBe(403);
  });
});
