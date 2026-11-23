import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { config } from "../config.js";
import { client } from "../db/index.js";
import { idle } from "../leads/background.js";

let app: FastifyInstance;
let base = "";
let geocoder: Server;

beforeAll(async () => {
  // Faux Nominatim : ne connaît que « Haie Vive » et « Akpakpa ».
  geocoder = createServer((req, res) => {
    const q = new URL(req.url!, "http://x").searchParams.get("q") ?? "";
    res.setHeader("content-type", "application/json");
    const hit = q.includes("Haie Vive") ? { lat: "6.3611", lon: "2.4098" } : q.includes("Akpakpa") ? { lat: "6.3552", lon: "2.4501" } : null;
    res.end(JSON.stringify(hit ? [{ ...hit, display_name: q }] : []));
  });
  await new Promise<void>((r) => geocoder.listen(0, "127.0.0.1", r));
  config.geocodingEnabled = true;
  config.geocoderUrl = `http://127.0.0.1:${(geocoder.address() as AddressInfo).port}`;
  app = await buildApp({ logger: false });
  base = await app.listen({ port: 0, host: "127.0.0.1" });
});
afterAll(async () => {
  await idle();
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
  const text = await res.text();
  return { status: res.status, text, json: () => JSON.parse(text), setCookie: res.headers.getSetCookie() };
}
async function user(): Promise<S> {
  const email = `import-${run}-${n++}@test.dev`;
  const r = await http(null, "POST", "/auth/register", { email, name: "T", password: "motdepasse-ok" });
  return { email, cookie: r.setCookie[0].split(";")[0] };
}
async function setup() {
  const ceo = await user();
  const c = await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "Cotonou", teamName: "T1" });
  ceo.companyId = c.json().company.id;
  const team1 = c.json().team.id;
  const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: any) => [r.key, r.id]));
  const add = async (key: string) => {
    const u = await user();
    expect((await http(ceo, "POST", "/members", { email: u.email, roleIds: [roles[key]], teamId: team1 })).status).toBe(201);
    u.companyId = ceo.companyId;
    return u;
  };
  return { ceo, add, roles };
}
const imp = (s: S, content: string, extra: Record<string, unknown> = {}) => http(s, "POST", "/leads/import", { content, ...extra });
const leadsOf = async (s: S) => (await http(s, "GET", "/leads")).json() as any[];

const CSV = [
  "name,sector,phone,whatsapp,status,lat,lng,estimatedValue,visited",
  'Boulangerie Soleil,Commerce,+229 97 00 11 22,+22997001122,À visiter,6.3654,2.3912,150000,non',
  "Pharmacie Étoile,Santé,,,Intéressé,6.3611,2.4098,,oui",
  '"Salon ""Prestige"", Akpakpa",Beauté,,,Maquette envoyée,,,90000,',
].join("\n");

describe("import : analyse à blanc", () => {
  it("analyse sans rien écrire et décrit ce qui sera importé", async () => {
    const { ceo } = await setup();
    const r = await imp(ceo, CSV);
    expect(r.status).toBe(200);
    expect(r.json()).toMatchObject({ dryRun: true, format: "csv", total: 3, valid: 3, invalid: 0, duplicates: 0, imported: 0, locating: 0, ignoredColumns: [] });
    expect(r.json().preview.map((p: any) => p.name)).toEqual(["Boulangerie Soleil", "Pharmacie Étoile", 'Salon "Prestige", Akpakpa']);
    expect(r.json().preview[0]).toMatchObject({ hasPosition: true, toLocate: false, status: "to_visit" });
    expect(await leadsOf(ceo)).toHaveLength(0); // rien d'écrit
  });

  it("dryRun est vrai par défaut : un oubli ne crée jamais de leads", async () => {
    const { ceo } = await setup();
    await imp(ceo, CSV); // sans dryRun
    expect(await leadsOf(ceo)).toHaveLength(0);
  });
});

describe("import : création", () => {
  it("importe un CSV : champs, étapes, valeurs, visites, propriétaire", async () => {
    const { ceo } = await setup();
    const r = await imp(ceo, CSV, { dryRun: false });
    expect(r.json()).toMatchObject({ dryRun: false, imported: 3, valid: 3 });
    const byName = Object.fromEntries((await leadsOf(ceo)).map((l) => [l.name, l]));
    expect(byName["Boulangerie Soleil"]).toMatchObject({ status: "to_visit", lat: 6.3654, lng: 2.3912, estimatedValue: 150000, whatsapp: "+22997001122", locationSource: "manual", visitedAt: null });
    expect(byName["Pharmacie Étoile"]).toMatchObject({ status: "interested" });
    expect(byName["Pharmacie Étoile"].visitedAt).not.toBeNull();
    expect(byName['Salon "Prestige", Akpakpa']).toMatchObject({ status: "mockup_sent", estimatedValue: 90000 });
  });

  it("importe un JSON (tableau ou { leads })", async () => {
    const { ceo } = await setup();
    const a = await imp(ceo, JSON.stringify([{ name: "A", status: "deposit_paid", lat: 6.3, lng: 2.4 }]), { dryRun: false });
    expect(a.json()).toMatchObject({ format: "json", imported: 1 });
    const b = await imp(ceo, JSON.stringify({ leads: [{ nom: "B", ville: "Cotonou" }] }), { dryRun: false });
    expect(b.json().imported).toBe(1);
    const all = await leadsOf(ceo);
    expect(all.find((l) => l.name === "A")).toMatchObject({ status: "deposit_paid" });
    expect(all.find((l) => l.name === "B")).toMatchObject({ city: "Cotonou" });
  });

  it("les leads importés appartiennent à celui qui importe, dans son équipe", async () => {
    const { ceo, add } = await setup();
    const p = await add("prospecteur");
    await imp(p, "name\nDu prospecteur", { dryRun: false });
    await imp(ceo, "name\nDu CEO", { dryRun: false });
    expect((await leadsOf(p)).map((l) => l.name)).toEqual(["Du prospecteur"]); // portée « own »
    expect(await leadsOf(ceo)).toHaveLength(2);
  });
});

describe("import : lignes invalides et doublons", () => {
  const MIXED = [
    "name,status,website,lat,lng",
    "Valide,À visiter,a.bj,6.3,2.4",
    ",À visiter,,,", // ligne 3 : nom manquant
    "Mauvaise étape,en pause,,,", // ligne 4
    "Mauvais lien,À visiter,javascript:alert(1),,", // ligne 5
    "Lat seule,À visiter,,6.3,", // ligne 6
  ].join("\n");

  it("écarte les lignes invalides et les liste avec leur numéro de ligne", async () => {
    const { ceo } = await setup();
    const r = (await imp(ceo, MIXED)).json();
    expect(r).toMatchObject({ total: 5, valid: 1, invalid: 4 });
    const byLine = Object.fromEntries(r.errors.map((e: any) => [e.line, e]));
    expect(byLine[3]).toMatchObject({ field: "name", message: "champ obligatoire" });
    expect(byLine[4]).toMatchObject({ field: "status" });
    expect(byLine[5]).toMatchObject({ field: "website" });
    expect(byLine[6]).toMatchObject({ field: "lat" });
  });

  it("importe les lignes valides et ignore les autres", async () => {
    const { ceo } = await setup();
    const r = (await imp(ceo, MIXED, { dryRun: false })).json();
    expect(r).toMatchObject({ imported: 1, invalid: 4 });
    expect((await leadsOf(ceo)).map((l) => l.name)).toEqual(["Valide"]);
  });

  it("un second import du même fichier ne crée rien : tout est doublon", async () => {
    const { ceo } = await setup();
    await imp(ceo, CSV, { dryRun: false });
    const again = (await imp(ceo, CSV, { dryRun: false })).json();
    expect(again).toMatchObject({ imported: 0, valid: 0, duplicates: 3 });
    expect(again.duplicateLines.map((d: any) => d.name)).toContain("Boulangerie Soleil");
    expect(await leadsOf(ceo)).toHaveLength(3);
  });

  it("détecte les doublons à l'intérieur du fichier lui-même", async () => {
    const { ceo } = await setup();
    const r = (await imp(ceo, "name,phone\nA,+229 11 22 33 44\nA,22911223344\nA,", { dryRun: false })).json();
    expect(r).toMatchObject({ imported: 2, duplicates: 1 }); // 3e ligne : sans téléphone → autre lead
  });

  it("deux leads de même nom mais d'adresses différentes ne sont pas des doublons", async () => {
    const { ceo } = await setup();
    const r = (await imp(ceo, "name,address\nPharmacie,Rue 1\nPharmacie,Rue 2", { dryRun: false })).json();
    expect(r).toMatchObject({ imported: 2, duplicates: 0 });
  });

  it("les doublons ne sont cherchés que parmi les leads visibles de l'importeur", async () => {
    const { ceo, add } = await setup();
    await imp(ceo, "name\nSecret du CEO", { dryRun: false });
    const p = await add("prospecteur");
    const r = (await imp(p, "name\nSecret du CEO", { dryRun: false })).json();
    expect(r).toMatchObject({ imported: 1, duplicates: 0 }); // il ne voit pas celui du CEO : rien n'est révélé
  });

  it("jamais de doublon détecté avec une autre entreprise", async () => {
    const a = await setup();
    const b = await setup();
    await imp(a.ceo, "name\nCommun", { dryRun: false });
    expect((await imp(b.ceo, "name\nCommun", { dryRun: false })).json()).toMatchObject({ imported: 1, duplicates: 0 });
    expect(await leadsOf(a.ceo)).toHaveLength(1);
  });
});

describe("import : positions", () => {
  it("lit les coordonnées d'un lien Google Maps, sans service tiers", async () => {
    const { ceo } = await setup();
    const csv = 'name,googleMapsUrl\nBoutique,"https://www.google.com/maps/place/B/@6.37,2.43,17z"';
    const r = (await imp(ceo, csv, { dryRun: false })).json();
    expect(r).toMatchObject({ imported: 1, locating: 0 });
    expect((await leadsOf(ceo))[0]).toMatchObject({ lat: 6.37, lng: 2.43, locationSource: "google_maps" });
  });

  it("place les adresses en arrière-plan : la réponse n'attend pas", async () => {
    const { ceo } = await setup();
    const csv = "name,address,city\nPharmacie,Haie Vive,Cotonou\nSalon,Akpakpa,Cotonou\nIntrouvable,Rue inconnue,Cotonou\nSans adresse,,";
    const preview = (await imp(ceo, csv)).json();
    expect(preview.preview.filter((p: any) => p.toLocate)).toHaveLength(3);
    const r = (await imp(ceo, csv, { dryRun: false })).json();
    expect(r).toMatchObject({ imported: 4, locating: 3 }); // « Sans adresse » n'est pas à localiser
    await idle();
    const byName = Object.fromEntries((await leadsOf(ceo)).map((l) => [l.name, l]));
    expect(byName["Pharmacie"]).toMatchObject({ lat: 6.3611, lng: 2.4098, locationSource: "address" });
    expect(byName["Salon"]).toMatchObject({ lat: 6.3552, lng: 2.4501, locationSource: "address" });
    expect(byName["Introuvable"]).toMatchObject({ lat: null, lng: null });
    expect(byName["Sans adresse"]).toMatchObject({ lat: null });
  });

  it("des coordonnées fournies ne sont jamais écrasées par la recherche d'adresse", async () => {
    const { ceo } = await setup();
    await imp(ceo, "name,address,lat,lng\nA,Haie Vive,1.5,2.5", { dryRun: false });
    await idle();
    expect((await leadsOf(ceo))[0]).toMatchObject({ lat: 1.5, lng: 2.5, locationSource: "manual" });
  });

  it("POST /leads/locate-missing relance la recherche des leads sans position", async () => {
    const { ceo } = await setup();
    // créés sans recherche automatique : géocodage coupé le temps de la création
    config.geocodingEnabled = false;
    await http(ceo, "POST", "/leads", { name: "Un", address: "Haie Vive" });
    await http(ceo, "POST", "/leads", { name: "Deux" }); // ni adresse ni lien : rien à chercher
    config.geocodingEnabled = true;
    const r = await http(ceo, "POST", "/leads/locate-missing");
    expect(r.status).toBe(202);
    expect(r.json()).toEqual({ queued: 1, geocoding: true });
    await idle();
    const byName = Object.fromEntries((await leadsOf(ceo)).map((l) => [l.name, l]));
    expect(byName["Un"]).toMatchObject({ lat: 6.3611, locationSource: "address" });
    expect(byName["Deux"].lat).toBeNull();
  });

  it("locate-missing exige le droit de modifier", async () => {
    const { add } = await setup();
    const a = await add("affilie");
    expect((await http(a, "POST", "/leads/locate-missing")).status).toBe(403);
  });
});

describe("import : aller-retour avec l'export", () => {
  it("un export CSV ou JSON se réimporte tel quel dans une autre entreprise", async () => {
    const a = await setup();
    await imp(a.ceo, CSV, { dryRun: false });
    const original = (await leadsOf(a.ceo)).sort((x, y) => x.name.localeCompare(y.name));
    for (const [format, delimiter] of [["csv", ","], ["csv", ";"], ["json", ","]] as const) {
      const b = await setup();
      const exported = (await http(a.ceo, "POST", "/leads/export", { format, delimiter })).text;
      const r = (await imp(b.ceo, exported, { dryRun: false })).json();
      expect(r, `${format}${delimiter}`).toMatchObject({ imported: 3, invalid: 0 });
      expect(r.ignoredColumns).toEqual([]); // les colonnes d'export sont reconnues, pas signalées
      const copy = (await leadsOf(b.ceo)).sort((x, y) => x.name.localeCompare(y.name));
      for (const [i, l] of copy.entries()) {
        const o = original[i];
        expect(l, `${format}${delimiter} ${o.name}`).toMatchObject({
          name: o.name,
          status: o.status,
          sector: o.sector,
          phone: o.phone,
          whatsapp: o.whatsapp,
          lat: o.lat,
          lng: o.lng,
          estimatedValue: o.estimatedValue,
        });
        expect(!!l.visitedAt).toBe(!!o.visitedAt);
      }
    }
  });
});

describe("import : droits et validation", () => {
  it("exige la connexion", async () => {
    expect((await http(null, "POST", "/leads/import", { content: "name\nA" })).status).toBe(401);
  });

  it("réservé à ceux qui peuvent créer des leads", async () => {
    const { ceo } = await setup();
    const role = (await http(ceo, "POST", "/roles", { name: "Lecteur", grants: [{ permission: "lead:read", scope: "company" }] })).json();
    const u = await user();
    await http(ceo, "POST", "/members", { email: u.email, roleIds: [role.id] });
    u.companyId = ceo.companyId;
    expect((await imp(u, "name\nA", { dryRun: false })).status).toBe(403);
  });

  it("répond par des erreurs claires à un fichier inutilisable", async () => {
    const { ceo } = await setup();
    const cases: [string, string, string][] = [
      ["   ", "import_empty", "vide"],
      ["name\n", "import_empty", "au moins un lead"],
      ["secteur,ville\nx,y", "import_no_name_column", "name"],
      ["[{name: oups}]", "import_invalid_json", "JSON invalide"],
      ['{"nom":"A"}', "import_invalid_json", "tableau"],
      ['a,b\n"jamais refermé,1', "import_invalid_csv", "guillemet"],
    ];
    for (const [content, code, message] of cases) {
      const r = await imp(ceo, content);
      expect(r.status, content).toBe(400);
      expect(r.json().error, content).toBe(code);
      expect(r.json().message, content).toContain(message);
    }
    expect((await http(ceo, "POST", "/leads/import", {})).status).toBe(400);
    expect((await http(ceo, "POST", "/leads/import", { content: "name\nA", format: "xml" })).status).toBe(400);
  });

  it("limite à 1000 lignes par import", async () => {
    const { ceo } = await setup();
    const big = "name\n" + Array.from({ length: 1001 }, (_, i) => `L${i}`).join("\n");
    const r = await imp(ceo, big);
    expect(r.status).toBe(400);
    expect(r.json()).toMatchObject({ error: "import_too_many_rows", max: 1000 });
    const ok = "name\n" + Array.from({ length: 1000 }, (_, i) => `L${i}`).join("\n");
    expect((await imp(ceo, ok, { dryRun: false })).json().imported).toBe(1000);
  });

  it("n'exécute rien : une formule dans un nom reste du texte", async () => {
    const { ceo } = await setup();
    await imp(ceo, 'name\n"=HYPERLINK(""http://evil.example"")"', { dryRun: false });
    const l = (await leadsOf(ceo))[0];
    expect(l.name).toBe('=HYPERLINK("http://evil.example")'); // stocké tel quel ; l'export le neutralise
    const csv = (await http(ceo, "POST", "/leads/export", { format: "csv" })).text;
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
  });
});
