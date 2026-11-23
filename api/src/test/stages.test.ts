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
async function user(): Promise<S> {
  const email = `stages-${run}-${n++}@test.dev`;
  const r = await http(null, "POST", "/auth/register", { email, name: "T", password: "motdepasse-ok" });
  return { email, cookie: r.setCookie[0].split(";")[0] };
}
async function setup() {
  const ceo = await user();
  const c = await http(ceo, "POST", "/companies", { name: "Acme", sector: "x", region: "y", teamName: "T1" });
  ceo.companyId = c.json().company.id;
  const roles = Object.fromEntries((await http(ceo, "GET", "/roles")).json().map((r: any) => [r.key, r.id]));
  const add = async (key: string) => {
    const u = await user();
    await http(ceo, "POST", "/members", { email: u.email, roleIds: [roles[key]] });
    u.companyId = ceo.companyId;
    return u;
  };
  return { ceo, add };
}
const stages = async (s: S) => (await http(s, "GET", "/stages")).json() as any[];
const byKey = async (s: S, key: string) => (await stages(s)).find((x) => x.key === key);
const mk = async (s: S, name: string, extra = {}) => (await http(s, "POST", "/leads", { name, ...extra })).json();
const lead = async (s: S, id: string) => ((await http(s, "GET", "/leads")).json() as any[]).find((l) => l.id === id);

describe("étapes par défaut", () => {
  it("une nouvelle entreprise reçoit les quatre étapes du cahier, puis gagné et perdu", async () => {
    const { ceo } = await setup();
    const s = await stages(ceo);
    expect(s.map((x) => x.key)).toEqual(["to_visit", "interested", "mockup_sent", "deposit_paid", "won", "lost"]);
    expect(s.map((x) => x.kind)).toEqual(["open", "open", "open", "open", "won", "lost"]);
    expect(s.map((x) => x.position)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s[0]).toMatchObject({ name: "À visiter", color: "#e5484d" });
    expect(s[2].color).toBe("rgba(34, 170, 94, 0.6)");
  });

  it("tout membre les lit, même sans droit sur les leads ; la connexion est exigée", async () => {
    const { add } = await setup();
    expect((await stages(await add("worker"))).length).toBe(6);
    expect((await http(null, "GET", "/stages")).status).toBe(401);
  });

  it("deux entreprises ont chacune leurs étapes", async () => {
    const a = await setup();
    const b = await setup();
    await http(a.ceo, "PATCH", `/stages/${(await byKey(a.ceo, "to_visit")).id}`, { name: "Prospect" });
    expect((await byKey(b.ceo, "to_visit")).name).toBe("À visiter");
  });
});

describe("gérer les étapes", () => {
  it("créer : clé tirée du nom, placée avant « gagné » et « perdu »", async () => {
    const { ceo } = await setup();
    const r = await http(ceo, "POST", "/stages", { name: "Négociation", color: "#8e4ec6", probability: 75 });
    expect(r.status).toBe(201);
    expect(r.json()).toMatchObject({ key: "negociation", kind: "open", probability: 75, color: "#8e4ec6" });
    const keys = (await stages(ceo)).map((s) => s.key);
    expect(keys).toEqual(["to_visit", "interested", "mockup_sent", "deposit_paid", "negociation", "won", "lost"]);
  });

  it("refuse un nom déjà pris (casse ignorée), une couleur ou une probabilité invalide", async () => {
    const { ceo } = await setup();
    expect((await http(ceo, "POST", "/stages", { name: "à visiter", color: "#000000" })).status).toBe(409);
    expect((await http(ceo, "POST", "/stages", { name: "X", color: "rouge" })).status).toBe(400);
    expect((await http(ceo, "POST", "/stages", { name: "X", color: "#000000", probability: 150 })).status).toBe(400);
    expect((await http(ceo, "POST", "/stages", { name: "", color: "#000000" })).status).toBe(400);
    expect((await http(ceo, "POST", "/stages", { name: "X", color: "#000000; background:url(x)" })).status).toBe(400);
  });

  it("limite à 20 étapes", async () => {
    const { ceo } = await setup();
    for (let i = 0; i < 14; i++) expect((await http(ceo, "POST", "/stages", { name: `Étape ${i}`, color: "#112233" })).status).toBe(201);
    expect((await http(ceo, "POST", "/stages", { name: "Une de trop", color: "#112233" })).status).toBe(409);
  });

  it("droits : CEO et manager gèrent, taffeur, prospecteur et affilié non", async () => {
    const { ceo, add } = await setup();
    const stage = await byKey(ceo, "interested");
    expect((await http(await add("manager"), "POST", "/stages", { name: "Du manager", color: "#112233" })).status).toBe(201);
    for (const role of ["worker", "prospecteur", "affilie"]) {
      const u = await add(role);
      expect((await http(u, "POST", "/stages", { name: "X", color: "#112233" })).status, role).toBe(403);
      expect((await http(u, "PATCH", `/stages/${stage.id}`, { name: "Y" })).status, role).toBe(403);
      expect((await http(u, "DELETE", `/stages/${stage.id}`)).status, role).toBe(403);
      expect((await http(u, "POST", "/stages/reorder", { ids: [stage.id] })).status, role).toBe(403);
    }
  });

  it("modifier le nom, la couleur et la probabilité ; la clé reste stable", async () => {
    const { ceo } = await setup();
    const st = await byKey(ceo, "mockup_sent");
    const r = await http(ceo, "PATCH", `/stages/${st.id}`, { name: "Devis envoyé", color: "#ff9900", probability: 55 });
    expect(r.json()).toMatchObject({ key: "mockup_sent", name: "Devis envoyé", color: "#ff9900", probability: 55 });
    expect((await http(ceo, "PATCH", `/stages/${st.id}`, { name: "Intéressé" })).status).toBe(409);
    expect((await http(ceo, "PATCH", `/stages/${st.id}`, { probability: -1 })).status).toBe(400);
    expect((await http(ceo, "PATCH", `/stages/${st.id}`, { name: "Devis envoyé" })).status).toBe(200); // son propre nom, pas un conflit
  });

  it("changer le type d'une étape met à jour la clôture de ses leads", async () => {
    const { ceo } = await setup();
    const st = await byKey(ceo, "deposit_paid");
    const l = await mk(ceo, "Client", { status: "deposit_paid" });
    expect(l.closedAt).toBeNull();
    await http(ceo, "PATCH", `/stages/${st.id}`, { kind: "won" });
    expect((await lead(ceo, l.id)).closedAt).not.toBeNull();
    await http(ceo, "PATCH", `/stages/${st.id}`, { kind: "open" });
    expect((await lead(ceo, l.id)).closedAt).toBeNull();
  });

  it("on garde toujours une étape ouverte", async () => {
    const { ceo } = await setup();
    for (const key of ["interested", "mockup_sent", "deposit_paid"]) await http(ceo, "DELETE", `/stages/${(await byKey(ceo, key)).id}`);
    const last = await byKey(ceo, "to_visit");
    expect((await http(ceo, "DELETE", `/stages/${last.id}`)).status).toBe(409);
    expect((await http(ceo, "PATCH", `/stages/${last.id}`, { kind: "won" })).json().error).toBe("last_open_stage");
  });

  it("réordonner : l'ordre est appliqué, les étapes ouvertes restent avant gagné et perdu", async () => {
    const { ceo } = await setup();
    const s = await stages(ceo);
    const order = [s[5], s[3], s[0], s[4], s[1], s[2]].map((x) => x.id); // « perdu » et « gagné » en tête
    const r = await http(ceo, "POST", "/stages/reorder", { ids: order });
    expect(r.status).toBe(200);
    expect(r.json().map((x: any) => x.key)).toEqual(["deposit_paid", "to_visit", "interested", "mockup_sent", "won", "lost"]);
  });

  it("réordonner exige exactement les étapes de l'entreprise", async () => {
    const a = await setup();
    const b = await setup();
    const s = await stages(a.ceo);
    expect((await http(a.ceo, "POST", "/stages/reorder", { ids: s.slice(1).map((x) => x.id) })).status).toBe(400); // il en manque une
    expect((await http(a.ceo, "POST", "/stages/reorder", { ids: [...s.map((x) => x.id).slice(0, 5), s[0].id] })).status).toBe(400); // doublon
    const foreign = (await stages(b.ceo)).map((x) => x.id);
    expect((await http(a.ceo, "POST", "/stages/reorder", { ids: foreign })).status).toBe(400); // étapes d'une autre entreprise
  });

  it("isolation : une étape d'une autre entreprise est introuvable", async () => {
    const a = await setup();
    const b = await setup();
    const foreign = await byKey(b.ceo, "interested");
    expect((await http(a.ceo, "PATCH", `/stages/${foreign.id}`, { name: "pwned" })).status).toBe(404);
    expect((await http(a.ceo, "DELETE", `/stages/${foreign.id}`)).status).toBe(404);
    expect((await http(a.ceo, "PATCH", "/stages/pas-un-uuid", { name: "x" })).status).toBe(404);
    expect((await byKey(b.ceo, "interested")).name).toBe("Intéressé");
  });
});

describe("supprimer une étape", () => {
  it("une étape vide se supprime ; les positions sont recompactées", async () => {
    const { ceo } = await setup();
    expect((await http(ceo, "DELETE", `/stages/${(await byKey(ceo, "interested")).id}`)).status).toBe(204);
    const s = await stages(ceo);
    expect(s.map((x) => x.key)).toEqual(["to_visit", "mockup_sent", "deposit_paid", "won", "lost"]);
    expect(s.map((x) => x.position)).toEqual([0, 1, 2, 3, 4]);
  });

  it("jamais de lead perdu : une étape utilisée exige une destination", async () => {
    const { ceo } = await setup();
    const st = await byKey(ceo, "interested");
    const l = await mk(ceo, "A", { status: "interested" });
    const refused = await http(ceo, "DELETE", `/stages/${st.id}`);
    expect(refused.status).toBe(409);
    expect(refused.json()).toMatchObject({ error: "stage_in_use", leads: 1 });
    expect((await http(ceo, "DELETE", `/stages/${st.id}?moveTo=inconnue`)).status).toBe(400);
    expect((await http(ceo, "DELETE", `/stages/${st.id}?moveTo=interested`)).status).toBe(400); // pas vers elle-même
    expect((await lead(ceo, l.id)).status).toBe("interested"); // rien n'a bougé
    expect((await http(ceo, "DELETE", `/stages/${st.id}?moveTo=mockup_sent`)).status).toBe(204);
    expect((await lead(ceo, l.id)).status).toBe("mockup_sent");
  });

  it("déplacer vers « perdu » ou « gagné » date la clôture, vers une étape ouverte l'efface", async () => {
    const { ceo } = await setup();
    const a = await mk(ceo, "A", { status: "interested" });
    await http(ceo, "DELETE", `/stages/${(await byKey(ceo, "interested")).id}?moveTo=won`);
    expect((await lead(ceo, a.id))).toMatchObject({ status: "won" });
    expect((await lead(ceo, a.id)).closedAt).not.toBeNull();
    const b = await mk(ceo, "B", { status: "won" });
    await http(ceo, "DELETE", `/stages/${(await byKey(ceo, "won")).id}?moveTo=to_visit`);
    expect(await lead(ceo, b.id)).toMatchObject({ status: "to_visit", closedAt: null });
  });
});

describe("leads et étapes", () => {
  it("sans étape demandée, le lead entre dans la première étape ouverte", async () => {
    const { ceo } = await setup();
    expect((await mk(ceo, "A")).status).toBe("to_visit");
    await http(ceo, "POST", "/stages/reorder", { ids: (await stages(ceo)).map((s) => s.id).reverse() }); // « perdu », « gagné » repassent après
    const first = (await stages(ceo)).find((s) => s.kind === "open");
    expect((await mk(ceo, "B")).status).toBe(first.key);
  });

  it("une étape créée par l'entreprise est utilisable ; une étape inconnue est refusée partout", async () => {
    const { ceo } = await setup();
    await http(ceo, "POST", "/stages", { name: "Négociation", color: "#8e4ec6" });
    expect((await mk(ceo, "A", { status: "negociation" })).status).toBe("negociation");
    const bad = await http(ceo, "POST", "/leads", { name: "B", status: "inconnue" });
    expect(bad.status).toBe(400);
    expect(bad.json().issues[0]).toMatchObject({ path: ["status"] });
    const l = await mk(ceo, "C");
    expect((await http(ceo, "PATCH", `/leads/${l.id}`, { status: "inconnue" })).status).toBe(400);
    expect((await http(ceo, "POST", "/leads/bulk-update", { ids: [l.id], status: "inconnue" })).status).toBe(400);
    expect((await lead(ceo, l.id)).status).toBe("to_visit");
  });

  it("une étape d'une autre entreprise n'existe pas pour moi, même si sa clé est la même", async () => {
    const a = await setup();
    const b = await setup();
    await http(b.ceo, "POST", "/stages", { name: "Spécial", color: "#112233" });
    expect((await http(a.ceo, "POST", "/leads", { name: "X", status: "special" })).status).toBe(400);
  });

  it("entrer dans « gagné » date la clôture ; revenir en arrière l'efface", async () => {
    const { ceo } = await setup();
    const l = await mk(ceo, "A");
    const won = (await http(ceo, "PATCH", `/leads/${l.id}`, { status: "won" })).json();
    expect(won).toMatchObject({ status: "won", lostReason: "" });
    expect(won.closedAt).not.toBeNull();
    const again = (await http(ceo, "PATCH", `/leads/${l.id}`, { status: "won", name: "A bis" })).json();
    expect(again.closedAt).toBe(won.closedAt); // la date de clôture d'origine est conservée
    expect((await http(ceo, "PATCH", `/leads/${l.id}`, { status: "interested" })).json()).toMatchObject({ closedAt: null, lostReason: "" });
  });

  it("« perdu » garde le motif ; le motif disparaît si le lead est rouvert", async () => {
    const { ceo } = await setup();
    const l = await mk(ceo, "A");
    const lost = (await http(ceo, "PATCH", `/leads/${l.id}`, { status: "lost", lostReason: "Trop cher" })).json();
    expect(lost).toMatchObject({ status: "lost", lostReason: "Trop cher" });
    expect(lost.closedAt).not.toBeNull();
    expect((await http(ceo, "PATCH", `/leads/${l.id}`, { lostReason: "Choisi un concurrent" })).json().lostReason).toBe("Choisi un concurrent"); // on peut corriger le motif
    expect((await http(ceo, "PATCH", `/leads/${l.id}`, { status: "to_visit" })).json()).toMatchObject({ lostReason: "", closedAt: null });
  });

  it("un motif donné à un lead qui n'est pas perdu est ignoré", async () => {
    const { ceo } = await setup();
    const l = await mk(ceo, "A");
    expect((await http(ceo, "PATCH", `/leads/${l.id}`, { lostReason: "Trop cher" })).json().lostReason).toBe("");
    expect((await mk(ceo, "B", { status: "interested", lostReason: "Trop cher" })).lostReason).toBe("");
    expect((await mk(ceo, "C", { status: "lost", lostReason: "Injoignable" })).lostReason).toBe("Injoignable");
  });

  it("actions de masse : vers « perdu » avec un motif, puis vers une étape ouverte", async () => {
    const { ceo } = await setup();
    const a = await mk(ceo, "A");
    const b = await mk(ceo, "B");
    const r = await http(ceo, "POST", "/leads/bulk-update", { ids: [a.id, b.id], status: "lost", lostReason: "Pas intéressé" });
    expect(r.json()).toEqual({ affected: 2, skipped: 0 });
    expect(await lead(ceo, a.id)).toMatchObject({ status: "lost", lostReason: "Pas intéressé" });
    // lost → lost sans motif : le motif existant est conservé
    await http(ceo, "POST", "/leads/bulk-update", { ids: [a.id], status: "lost" });
    expect((await lead(ceo, a.id)).lostReason).toBe("Pas intéressé");
    await http(ceo, "POST", "/leads/bulk-update", { ids: [a.id, b.id], status: "interested" });
    expect(await lead(ceo, b.id)).toMatchObject({ status: "interested", lostReason: "", closedAt: null });
  });

  it("l'export utilise le nom de l'étape de l'entreprise, avec le motif et la clôture", async () => {
    const { ceo } = await setup();
    await http(ceo, "PATCH", `/stages/${(await byKey(ceo, "lost")).id}`, { name: "Abandonné" });
    const l = await mk(ceo, "A");
    await http(ceo, "PATCH", `/leads/${l.id}`, { status: "lost", lostReason: "Trop cher" });
    const [row] = (await http(ceo, "POST", "/leads/export", { format: "json" })).json();
    expect(row).toMatchObject({ status: "lost", statusLabel: "Abandonné", lostReason: "Trop cher" });
    expect(row.closedAt).not.toBeNull();
  });

  it("l'import reconnaît les étapes de l'entreprise par leur nom, et liste celles qu'il connaît en cas d'erreur", async () => {
    const { ceo } = await setup();
    await http(ceo, "POST", "/stages", { name: "Négociation", color: "#8e4ec6" });
    const csv = "name,status\nA,Négociation\nB,gagné\nC,Perdu\nD,n'importe quoi";
    const r = (await http(ceo, "POST", "/leads/import", { content: csv, dryRun: false })).json();
    expect(r).toMatchObject({ imported: 3, invalid: 1 });
    expect(r.errors[0].message).toContain("Négociation"); // la liste des étapes valides inclut celle de l'entreprise
    const all = (await http(ceo, "GET", "/leads")).json() as any[];
    const get = (name: string) => all.find((l) => l.name === name);
    expect(get("A").status).toBe("negociation");
    expect(get("B")).toMatchObject({ status: "won" });
    expect(get("B").closedAt).not.toBeNull();
    expect(get("C").status).toBe("lost");
  });
});
