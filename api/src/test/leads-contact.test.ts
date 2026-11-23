import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { config } from "../config.js";
import { client } from "../db/index.js";

let app: FastifyInstance;
let base = "";
let geocoder: Server;
const geocoderCalls: { q: string; ua: string | undefined }[] = [];

beforeAll(async () => {
  // Faux Nominatim : connaît « Haie Vive », ne connaît rien d'autre.
  geocoder = createServer((req, res) => {
    const q = new URL(req.url!, "http://x").searchParams.get("q") ?? "";
    geocoderCalls.push({ q, ua: req.headers["user-agent"] });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(q.includes("Haie Vive") ? [{ lat: "6.3611", lon: "2.4098", display_name: "Haie Vive, Cotonou" }] : []));
  });
  await new Promise<void>((r) => geocoder.listen(0, "127.0.0.1", r));
  config.geocodingEnabled = true;
  config.geocoderUrl = `http://127.0.0.1:${(geocoder.address() as AddressInfo).port}`;
  app = await buildApp({ logger: false });
  base = await app.listen({ port: 0, host: "127.0.0.1" });
});
afterAll(async () => {
  config.geocodingEnabled = false;
  await app.close();
  geocoder.close();
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
  // octets bruts : Response.text() retirerait le BOM UTF-8 que le serveur envoie volontairement
  const raw = Buffer.from(await res.arrayBuffer());
  const text = raw.toString("utf8");
  return {
    raw,
    status: res.status,
    headers: res.headers,
    text,
    json: () => JSON.parse(text),
    setCookie: res.headers.getSetCookie(),
  };
}
async function user(): Promise<S> {
  const email = `contact-${run}-${n++}@test.dev`;
  const r = await http(null, "POST", "/auth/register", { email, name: "T", password: "motdepasse-ok" });
  return { email, cookie: r.setCookie[0].split(";")[0] };
}
async function setup() {
  const ceo = await user();
  const c = await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "Cotonou", teamName: "T1" });
  ceo.companyId = c.json().company.id;
  const team1 = c.json().team.id;
  const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: any) => [r.key, r.id]));
  const add = async (key: string, roleId = roles[key]) => {
    const u = await user();
    expect((await http(ceo, "POST", "/members", { email: u.email, roleIds: [roleId], teamId: team1 })).status).toBe(201);
    u.companyId = ceo.companyId;
    return u;
  };
  return { ceo, add, roles };
}
const mk = (s: S, name: string, extra = {}) => http(s, "POST", "/leads", { name, ...extra });

describe("fiche lead : contacts et adresse", () => {
  it("enregistre et normalise WhatsApp, Facebook, site, Google Maps, ville et repère", async () => {
    const { ceo } = await setup();
    const r = await mk(ceo, "Pharmacie", {
      whatsapp: "+229 97 00-11 22",
      facebook: "@pharmacie.etoile",
      website: "pharmacie.bj",
      googleMapsUrl: "https://maps.app.goo.gl/AbCd",
      address: "Rue 12",
      city: "Cotonou",
      landmark: "En face de la pharmacie, 2e étage",
      lat: 6.36,
      lng: 2.41,
    });
    expect(r.status).toBe(201);
    expect(r.json()).toMatchObject({
      whatsapp: "+22997001122",
      facebook: "https://www.facebook.com/pharmacie.etoile",
      website: "https://pharmacie.bj/",
      googleMapsUrl: "https://maps.app.goo.gl/AbCd",
      city: "Cotonou",
      landmark: "En face de la pharmacie, 2e étage",
      locationSource: "manual",
    });
  });

  it("refuse les liens dangereux ou d'un mauvais domaine", async () => {
    const { ceo } = await setup();
    for (const extra of [
      { website: "javascript:alert(1)" },
      { facebook: "https://evil.example/facebook.com" },
      { googleMapsUrl: "https://evil.example/maps" },
      { whatsapp: "pas un numéro" },
    ]) {
      expect((await mk(ceo, "X", extra)).status, JSON.stringify(extra)).toBe(400);
    }
  });

  it("modifie la fiche, et une valeur vide efface le champ", async () => {
    const { ceo } = await setup();
    const lead = (await mk(ceo, "A", { website: "a.bj", lat: 6.3, lng: 2.4 })).json();
    const up = await http(ceo, "PATCH", `/leads/${lead.id}`, { website: "", whatsapp: "+22990000000" });
    expect(up.status).toBe(200);
    expect(up.json()).toMatchObject({ website: "", whatsapp: "+22990000000", lat: 6.3, lng: 2.4 });
  });
});

describe("placement automatique sur la carte", () => {
  it("coordonnées données par l'utilisateur : conservées, source « manual », pas de géocodage", async () => {
    const { ceo } = await setup();
    const before = geocoderCalls.length;
    const l = (await mk(ceo, "A", { address: "Haie Vive", lat: 1.5, lng: 2.5 })).json();
    expect(l).toMatchObject({ lat: 1.5, lng: 2.5, locationSource: "manual" });
    expect(geocoderCalls.length).toBe(before);
  });

  it("lien Google Maps avec coordonnées : placé sans aucun appel à un service tiers", async () => {
    const { ceo } = await setup();
    const before = geocoderCalls.length;
    const l = (await mk(ceo, "A", { googleMapsUrl: "https://www.google.com/maps/place/X/@6.3654,2.3912,17z" })).json();
    expect(l).toMatchObject({ lat: 6.3654, lng: 2.3912, locationSource: "google_maps" });
    expect(geocoderCalls.length).toBe(before);
  });

  it("adresse seule : géocodée avec la région de l'entreprise comme contexte", async () => {
    const { ceo } = await setup();
    const l = (await mk(ceo, "A", { address: "Haie Vive" })).json();
    expect(l).toMatchObject({ lat: 6.3611, lng: 2.4098, locationSource: "address" });
    const call = geocoderCalls.at(-1)!;
    expect(call.q).toBe("Haie Vive, Cotonou"); // ville absente → région de l'entreprise
    expect(call.ua).toBe("harvest-api");
  });

  it("la ville saisie prime sur la région de l'entreprise", async () => {
    const { ceo } = await setup();
    await mk(ceo, "A", { address: "Haie Vive", city: "Porto-Novo" });
    expect(geocoderCalls.at(-1)!.q).toBe("Haie Vive, Porto-Novo");
  });

  it("adresse introuvable : le lead est créé quand même, sans position", async () => {
    const { ceo } = await setup();
    const r = await mk(ceo, "A", { address: "Rue inconnue de tous" });
    expect(r.status).toBe(201);
    expect(r.json()).toMatchObject({ lat: null, lng: null, locationSource: "" });
  });

  it("sans adresse ni lien : pas de géocodage, jamais de position inventée", async () => {
    const { ceo } = await setup();
    const before = geocoderCalls.length;
    const l = (await mk(ceo, "A", { city: "Cotonou", landmark: "près du marché" })).json();
    expect(l).toMatchObject({ lat: null, lng: null });
    expect(geocoderCalls.length).toBe(before);
  });

  it("ajouter une adresse à un lead sans position le localise ; un lead déjà placé n'est pas déplacé", async () => {
    const { ceo } = await setup();
    const lead = (await mk(ceo, "A")).json();
    const up = (await http(ceo, "PATCH", `/leads/${lead.id}`, { address: "Haie Vive" })).json();
    expect(up).toMatchObject({ lat: 6.3611, lng: 2.4098, locationSource: "address" });
    const moved = (await http(ceo, "PATCH", `/leads/${lead.id}`, { address: "Autre adresse" })).json();
    expect(moved).toMatchObject({ lat: 6.3611, lng: 2.4098 }); // épinglé : seul le sélecteur le déplace
    const cleared = (await http(ceo, "PATCH", `/leads/${lead.id}`, { lat: null, lng: null })).json();
    expect(cleared).toMatchObject({ lat: null, lng: null, locationSource: "" });
  });

  it("POST /locate : lien Google Maps, adresse, introuvable, paramètres vides", async () => {
    const { ceo } = await setup();
    const g = await http(ceo, "POST", "/locate", { googleMapsUrl: "https://www.google.com/maps/@6.5,2.6,15z" });
    expect(g.json()).toMatchObject({ found: true, lat: 6.5, lng: 2.6, source: "google_maps" });
    const a = await http(ceo, "POST", "/locate", { address: "Haie Vive" });
    expect(a.json()).toMatchObject({ found: true, source: "address" });
    expect((await http(ceo, "POST", "/locate", { address: "zzz introuvable" })).json()).toEqual({ found: false, reason: "not_found" });
    expect((await http(ceo, "POST", "/locate", {})).status).toBe(400);
    expect((await http(null, "POST", "/locate", { address: "x" })).status).toBe(401);
  });

  it("POST /locate : réservé à ceux qui peuvent créer ou modifier des leads", async () => {
    const { ceo, roles } = await setup();
    const custom = (
      await http(ceo, "POST", "/roles", { name: "Lecteur", grants: [{ permission: "lead:read", scope: "company" }] })
    ).json();
    const u = await user();
    await http(ceo, "POST", "/members", { email: u.email, roleIds: [custom.id] });
    u.companyId = ceo.companyId;
    expect((await http(u, "POST", "/locate", { address: "Haie Vive" })).status).toBe(403);
    void roles;
  });
});

describe("export CSV et JSON", () => {
  it("le CEO exporte en JSON et en CSV, avec les nouveaux champs", async () => {
    const { ceo } = await setup();
    await mk(ceo, "Boulangerie", { whatsapp: "+22997001122", city: "Cotonou", lat: 6.3, lng: 2.4, estimatedValue: 5000 });
    const j = await http(ceo, "POST", "/leads/export", { format: "json" });
    expect(j.status).toBe(200);
    expect(j.headers.get("content-type")).toContain("application/json");
    expect(j.headers.get("content-disposition")).toMatch(/^attachment; filename="leads-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(j.json()).toHaveLength(1);
    expect(j.json()[0]).toMatchObject({ name: "Boulangerie", whatsapp: "+22997001122", city: "Cotonou", lat: 6.3, estimatedValue: 5000, statusLabel: "À visiter", owner: "T" });

    const c = await http(ceo, "POST", "/leads/export", { format: "csv" });
    expect(c.headers.get("content-type")).toContain("text/csv");
    expect(c.text.startsWith("﻿id,name,status,")).toBe(true);
    expect(c.text).toContain("Boulangerie");
    const semi = await http(ceo, "POST", "/leads/export", { format: "csv", delimiter: ";" });
    expect(semi.text.split("\r\n")[0]).toContain("id;name;");
  });

  it("neutralise une formule injectée dans un nom de lead", async () => {
    const { ceo } = await setup();
    await mk(ceo, '=HYPERLINK("http://evil.example","clic")');
    const csv = (await http(ceo, "POST", "/leads/export", { format: "csv" })).text;
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""clic"")"`);
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });

  it("peut se limiter à une sélection d'ids", async () => {
    const { ceo } = await setup();
    const a = (await mk(ceo, "A")).json();
    await mk(ceo, "B");
    const r = (await http(ceo, "POST", "/leads/export", { format: "json", ids: [a.id] })).json();
    expect(r.map((x: any) => x.name)).toEqual(["A"]);
  });

  it("droit lead:export requis : taffeur, prospecteur et affilié n'exportent pas", async () => {
    const { ceo, add } = await setup();
    await mk(ceo, "A");
    for (const key of ["worker", "prospecteur", "affilie"]) {
      const u = await add(key);
      expect((await http(u, "POST", "/leads/export", { format: "json" })).status, key).toBe(403);
    }
    const mgr = await add("manager");
    expect((await http(mgr, "POST", "/leads/export", { format: "json" })).status).toBe(200);
  });

  it("un rôle personnalisé avec export limité à « own » n'exporte que ses leads", async () => {
    const { ceo } = await setup();
    const role = (
      await http(ceo, "POST", "/roles", {
        name: "Prospecteur+",
        grants: [
          { permission: "lead:create", scope: "company" },
          { permission: "lead:read", scope: "company" },
          { permission: "lead:export", scope: "own" },
        ],
      })
    ).json();
    const u = await user();
    await http(ceo, "POST", "/members", { email: u.email, roleIds: [role.id] });
    u.companyId = ceo.companyId;
    await mk(ceo, "du CEO");
    await mk(u, "du prospecteur");
    const r = (await http(u, "POST", "/leads/export", { format: "json" })).json();
    expect(r.map((x: any) => x.name)).toEqual(["du prospecteur"]);
  });

  it("isolation : jamais les leads d'une autre entreprise, même avec leurs ids", async () => {
    const a = await setup();
    const b = await setup();
    const foreign = (await mk(b.ceo, "secret")).json();
    await mk(a.ceo, "à moi");
    const r = (await http(a.ceo, "POST", "/leads/export", { format: "json", ids: [foreign.id] })).json();
    expect(r).toEqual([]);
    expect((await http(a.ceo, "POST", "/leads/export", { format: "json" })).json().map((x: any) => x.name)).toEqual(["à moi"]);
  });

  it("expose le nom de fichier proposé au navigateur (CORS)", async () => {
    const res = await fetch(base + "/health", { headers: { origin: config.appUrls[0] } });
    expect(res.headers.get("access-control-expose-headers")).toContain("content-disposition");
  });

  it("valide la demande et exige la connexion", async () => {
    const { ceo } = await setup();
    expect((await http(ceo, "POST", "/leads/export", { format: "xml" })).status).toBe(400);
    expect((await http(ceo, "POST", "/leads/export", { format: "csv", ids: ["pas-un-uuid"] })).status).toBe(400);
    expect((await http(null, "POST", "/leads/export", { format: "csv" })).status).toBe(401);
  });
});
