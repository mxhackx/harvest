import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { client } from "../db/index.js";
import { setStorage } from "../storage/index.js";

/**
 * Isolation entre entreprises (cahier des charges SEC-01 et SEC-02).
 * L'entreprise A possède des données ; le CEO de l'entreprise B, qui a tous les droits chez lui, essaie de les lire, de les
 * modifier et de les rattacher aux siennes, route par route. Puis A rejoue les mêmes requêtes : elles doivent passer, ce
 * qui prouve que le refus venait des droits et non d'une requête mal formée.
 * Toute nouvelle route doit être décrite ici, sinon le test échoue.
 */
let app: FastifyInstance;
let base = "";
const routes = new Set<string>();

type S = { cookie: string; email: string; userId: string; companyId: string };
type Res = { status: number; text: string; json: any };
const run = Math.random().toString(36).slice(2, 8);
const MARK = `SECRETDEA${run}`;
let n = 0;

async function http(s: Partial<S>, method: string, url: string, body?: unknown, companyId = s.companyId): Promise<Res> {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(s.cookie ? { cookie: s.cookie } : {}), ...(companyId ? { "x-company-id": companyId } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}
async function must(s: Partial<S>, method: string, url: string, body?: unknown): Promise<any> {
  const r = await http(s, method, url, body);
  if (r.status >= 300) throw new Error(`préparation : ${method} ${url} → ${r.status} ${r.text.slice(0, 200)}`);
  return r.json;
}
async function register(label: string) {
  const email = `iso-${label}-${run}-${n++}@test.dev`;
  const res = await fetch(base + "/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: `${label === "a" ? MARK : "B"} ${label}`, password: "motdepasse-ok" }) });
  const s = { cookie: res.headers.getSetCookie()[0].split(";")[0], email } as S;
  s.userId = (await http(s, "GET", "/me")).json.user.id;
  return s;
}
async function company(label: "a" | "b"): Promise<S> {
  const s = await register(label);
  s.companyId = (await must(s, "POST", "/companies", { name: label === "a" ? MARK : "Entreprise B", sector: "x", region: "y", teamName: "T1" })).company.id;
  return s;
}

const T = MARK;
const lines = (label: string) => [{ label, quantity: 1, unitPrice: 1000 }];
const CONFIG = { tab: "all", query: "", sort: "recent", filters: { mode: "all", visit: "all", position: "all", sector: "all" } };
const GRAPH = { nodes: [{ id: "start", type: "start", label: "Start", position: { x: 0, y: 0 }, config: { trigger: "manual" } }], edges: [] };

const siteData = (name: string) => ({ name: name.slice(0, 60), variables: [], styles: [], pages: [{ id: "p", name: "Accueil", path: "", root: { id: "r", type: "frame", name: "Page", props: {}, children: [] } }] });

/** Crée dans une entreprise une ressource de chaque sorte et renvoie leurs identifiants. */
async function seed(s: S, tag: string) {
  const id = async (method: string, url: string, body?: unknown) => (await must(s, method, url, body)).id as string;
  const lead = (name: string) => id("POST", "/leads", { name: `${tag} ${name}`, lat: 6.36, lng: 2.4 });
  const x: Record<string, string> = {};
  for (const k of ["lead", "lead2", "mergeKeep", "mergeGone", "eraseLead", "trashed"]) x[k] = await lead(k);
  await must(s, "DELETE", `/leads/${x.trashed}`);
  x.contact = await id("POST", `/leads/${x.lead}/contacts`, { name: tag, email: `c-${run}-${n++}@test.dev` });
  x.erasable = await id("POST", `/leads/${x.eraseLead}/contacts`, { name: tag });
  x.activity = await id("POST", `/leads/${x.lead}/activities`, { kind: "note", body: tag });
  x.account = await id("POST", "/accounts", { name: `${tag} compte` });
  x.quote = await id("POST", `/leads/${x.lead}/quotes`, { title: tag, lines: lines(tag) });
  x.accepted = await id("POST", `/leads/${x.lead}/quotes`, { title: tag, lines: lines(tag) });
  await must(s, "POST", `/quotes/${x.accepted}/status`, { status: "sent" });
  await must(s, "POST", `/quotes/${x.accepted}/status`, { status: "accepted" });
  x.invoice = await id("POST", `/leads/${x.lead}/invoices`, { title: tag, lines: lines(tag) });
  x.event = await id("POST", "/events", { title: tag, startsAt: "2030-01-02T10:00:00.000Z" });
  x.task = await id("POST", "/tasks", { title: tag });
  x.template = await id("POST", "/templates", { name: `${tag} modele`, channel: "email", body: tag });
  x.segment = await id("POST", "/segments", { name: `${tag} segment`, config: CONFIG });
  x.stage = await id("POST", "/stages", { name: `${tag.slice(0, 30)} e`, color: "#112233" });
  x.region = await id("POST", "/regions", { name: `${tag.slice(0, 40)} region`, lat: 6.36, lng: 2.4, radiusKm: 20 });
  x.wave = await id("POST", "/waves", { regionId: x.region, name: tag, startsOn: "2030-01-01", endsOn: "2030-01-31" });
  x.tour = await id("POST", "/tours", { name: tag, plannedOn: "2030-01-05", start: { lat: 6.36, lng: 2.38, label: tag }, leadIds: [x.lead] });
  x.ticket = await id("POST", "/tickets", { title: tag });
  x.article = await id("POST", "/kb", { title: tag, body: tag });
  x.webhook = await id("POST", "/webhooks", { url: `https://example.com/${tag}`, events: ["lead.created"] });
  x.workflow = await id("POST", "/workflows", { name: tag, graph: GRAPH });
  x.automation = await id("POST", "/automations", { kind: "task", name: tag, params: { title: tag, afterDays: 3 } });
  x.field = await id("POST", "/custom-fields", { label: `${tag.slice(0, 40)} champ`, type: "text" });
  x.role = await id("POST", "/roles", { name: `${tag.slice(0, 30)} role`, grants: [{ permission: "lead:read", scope: "own" }] });
  x.team = await id("POST", "/teams", { name: `${tag} equipe` });
  x.attachment = await id("POST", `/leads/${x.lead}/attachments`, { name: `${tag}.pdf`, size: 100, type: "application/pdf" });
  await must(s, "POST", `/attachments/${x.attachment}/complete`, {});
  await must(s, "POST", "/cms/account", {});
  x.site = await id("POST", "/cms/sites", { data: siteData(tag) });
  const other = await register(tag === MARK ? "a" : "b");
  const roles = (await must(s, "GET", "/roles")) as { id: string; key: string }[];
  x.sysRole = roles.find((r) => r.key === "prospecteur")!.id;
  x.membership = (await must(s, "POST", "/members", { email: other.email, roleIds: [x.sysRole] })).id;
  x.member = other.userId;
  x.invitation = (await must(s, "POST", "/invitations", { email: `inv-${run}-${n++}@test.dev`, roleIds: [x.sysRole] })).id;
  return x;
}

let A: S, B: S;
let a: Record<string, string>, b: Record<string, string>;
let aStages: string[];
beforeAll(async () => {
  // stockage factice : tout fichier « arrivé » est un PDF
  setStorage({ signUpload: async (p) => `https://stockage.test/envoi/${p}`, signDownload: async (p) => `https://stockage.test/${p}`, head: async () => ({ size: 100, start: new TextEncoder().encode("%PDF-1.7") }), remove: async () => {} });
  app = await buildApp({ logger: false, onRoute: (m, url) => routes.add(`${m} ${url}`) });
  base = await app.listen({ port: 0, host: "127.0.0.1" });
  A = await company("a");
  B = await company("b");
  a = await seed(A, MARK);
  b = await seed(B, "Entreprise B");
  aStages = ((await must(A, "GET", "/stages")) as { id: string }[]).map((x) => x.id);
}, 120_000);
afterAll(async () => {
  setStorage(undefined);
  await app.close();
  await client.end();
});

/** soft : la route ignore en silence ce qui n'est pas à soi (actions groupées) ; la base prouve alors que rien n'a bougé. */
type Attack = { route: string; url?: () => string; body?: () => unknown; soft?: boolean };
const on = (route: string, url?: () => string, body?: () => unknown, soft = false): Attack => ({ route, url, body, soft });

/** Requêtes visant les ressources de A. Les suppressions sont à la fin (A doit pouvoir rejouer le reste avant). */
const ATTACKS: Attack[] = [
  on("GET /accounts/:id", () => `/accounts/${a.account}`),
  on("PATCH /accounts/:id", () => `/accounts/${a.account}`, () => ({ name: "pris" })),
  on("PUT /cms/sites/:id", () => `/cms/sites/${a.site}`, () => ({ data: siteData("pris"), version: 1 })),
  on("GET /leads/:id/attachments", () => `/leads/${a.lead}/attachments`),
  on("POST /leads/:id/attachments", () => `/leads/${a.lead}/attachments`, () => ({ name: "intrus.pdf", size: 10, type: "application/pdf" })),
  on("POST /attachments/:id/complete", () => `/attachments/${a.attachment}/complete`, () => ({})),
  on("GET /attachments/:id/url", () => `/attachments/${a.attachment}/url`),
  on("POST /leads/:id/account", () => `/leads/${a.lead2}/account`, () => ({})),
  on("PATCH /activities/:id", () => `/activities/${a.activity}`, () => ({ body: "pris" })),
  on("PATCH /contacts/:id", () => `/contacts/${a.contact}`, () => ({ name: "pris" })),
  on("GET /contacts/:id/export", () => `/contacts/${a.contact}/export`),
  on("GET /leads/:id/activities", () => `/leads/${a.lead}/activities`),
  on("POST /leads/:id/activities", () => `/leads/${a.lead}/activities`, () => ({ kind: "note", body: "intrus" })),
  on("GET /leads/:id/contacts", () => `/leads/${a.lead}/contacts`),
  on("POST /leads/:id/contacts", () => `/leads/${a.lead}/contacts`, () => ({ name: "intrus" })),
  on("POST /leads/:id/emails", () => `/leads/${a.lead}/emails`, () => ({ to: "x@test.dev", subject: "x", body: "y" })),
  on("GET /leads/:id/invoices", () => `/leads/${a.lead}/invoices`),
  on("POST /leads/:id/invoices", () => `/leads/${a.lead}/invoices`, () => ({ title: "intrus" })),
  on("GET /leads/:id/mentionable", () => `/leads/${a.lead}/mentionable`),
  on("GET /leads/:id/quotes", () => `/leads/${a.lead}/quotes`),
  on("POST /leads/:id/quotes", () => `/leads/${a.lead}/quotes`, () => ({ title: "intrus" })),
  on("POST /leads/:id/quotes/import", () => `/leads/${a.lead}/quotes/import`, () => ({ format: "json", content: JSON.stringify([{ title: "intrus", lines: lines("intrus") }]), dryRun: false })),
  on("PATCH /leads/:id", () => `/leads/${a.lead}`, () => ({ name: "pris" })),
  on("GET /quotes/:id", () => `/quotes/${a.quote}`),
  on("PATCH /quotes/:id", () => `/quotes/${a.quote}`, () => ({ title: `${T} bis` })),
  on("POST /quotes/:id/status", () => `/quotes/${a.quote}/status`, () => ({ status: "sent" })),
  on("POST /quotes/:id/invoice", () => `/quotes/${a.accepted}/invoice`, () => ({})),
  on("GET /invoices/:id", () => `/invoices/${a.invoice}`),
  on("PATCH /invoices/:id", () => `/invoices/${a.invoice}`, () => ({ title: `${T} bis` })),
  on("POST /invoices/:id/status", () => `/invoices/${a.invoice}/status`, () => ({ status: "sent" })),
  on("PATCH /events/:id", () => `/events/${a.event}`, () => ({ title: "pris" })),
  on("PATCH /tasks/:id", () => `/tasks/${a.task}`, () => ({ title: "pris" })),
  on("PATCH /templates/:id", () => `/templates/${a.template}`, () => ({ body: "pris" })),
  on("GET /segments/:id", () => `/segments/${a.segment}`),
  on("PATCH /segments/:id", () => `/segments/${a.segment}`, () => ({ description: "pris" })),
  on("PATCH /stages/:id", () => `/stages/${a.stage}`, () => ({ probability: 10 })),
  on("PATCH /regions/:id", () => `/regions/${a.region}`, () => ({ radiusKm: 25 })),
  on("PATCH /waves/:id", () => `/waves/${a.wave}`, () => ({ targetVisits: 5 })),
  on("GET /waves/:id/revisit", () => `/waves/${a.wave}/revisit`),
  on("POST /waves/:id/close", () => `/waves/${a.wave}/close`, () => ({})),
  on("GET /tours/:id", () => `/tours/${a.tour}`),
  on("PATCH /tours/:id", () => `/tours/${a.tour}`, () => ({ status: "done" })),
  on("POST /tours/plan", undefined, () => ({ start: { lat: 6, lng: 2 }, leadIds: [a.lead] })),
  on("POST /tours", undefined, () => ({ name: "t", plannedOn: "2030-02-01", start: { lat: 6, lng: 2 }, leadIds: [a.lead] })),
  on("GET /tickets/:id", () => `/tickets/${a.ticket}`),
  on("PATCH /tickets/:id", () => `/tickets/${a.ticket}`, () => ({ priority: "high" })),
  on("POST /tickets/:id/comments", () => `/tickets/${a.ticket}/comments`, () => ({ body: "intrus" })),
  on("GET /kb/:id", () => `/kb/${a.article}`),
  on("PATCH /kb/:id", () => `/kb/${a.article}`, () => ({ title: `${T} bis`, body: T })),
  on("POST /webhooks/:id/test", () => `/webhooks/${a.webhook}/test`, () => ({})),
  on("GET /workflows/:id", () => `/workflows/${a.workflow}`),
  on("PATCH /workflows/:id", () => `/workflows/${a.workflow}`, () => ({ name: `${T} bis` })),
  on("PATCH /automations/:id", () => `/automations/${a.automation}`, () => ({ active: false })),
  on("PATCH /custom-fields/:id", () => `/custom-fields/${a.field}`, () => ({ label: `${T.slice(0, 40)} bis` })),
  on("PATCH /roles/:id", () => `/roles/${a.role}`, () => ({ description: "pris" })),
  on("POST /roles/:id/reset", () => `/roles/${a.sysRole}/reset`, () => ({})),
  on("PATCH /teams/:id", () => `/teams/${a.team}`, () => ({ name: `${T} bis` })),
  on("PUT /members/:id/team", () => `/members/${a.membership}/team`, () => ({ teamId: a.team })),
  on("PUT /members/:id/roles", () => `/members/${a.membership}/roles`, () => ({ roleIds: [a.sysRole] })),
  on("POST /leads/assign", undefined, () => ({ ids: [a.lead], ownerId: a.member })),
  on("POST /leads/bulk-update", undefined, () => ({ ids: [a.lead], visited: true }), true),
  on("POST /leads/export", undefined, () => ({ format: "json", ids: [a.lead] }), true),
  on("POST /leads/merge", undefined, () => ({ keepId: a.mergeKeep, mergeIds: [a.mergeGone] })),
  on("POST /leads/trash/restore", undefined, () => ({ ids: [a.trashed] }), true),
  on("PUT /objectives", undefined, () => ({ userId: a.member, month: "2030-01", targetVisits: 1, targetWon: 1, targetValue: 1 })),
  on("POST /stages/reorder", undefined, () => ({ ids: aStages })),
  on("POST /notifications/read", undefined, () => ({ ids: [a.lead] }), true),
  // suppressions
  on("POST /contacts/:id/erase", () => `/contacts/${a.erasable}/erase`, () => ({ confirm: true })),
  on("DELETE /contacts/:id", () => `/contacts/${a.contact}`),
  on("DELETE /cms/sites/:id", () => `/cms/sites/${a.site}`),
  on("DELETE /attachments/:id", () => `/attachments/${a.attachment}`),
  on("DELETE /activities/:id", () => `/activities/${a.activity}`),
  on("DELETE /invoices/:id", () => `/invoices/${a.invoice}`),
  on("DELETE /quotes/:id", () => `/quotes/${a.quote}`),
  on("DELETE /events/:id", () => `/events/${a.event}`),
  on("DELETE /tasks/:id", () => `/tasks/${a.task}`),
  on("DELETE /templates/:id", () => `/templates/${a.template}`),
  on("DELETE /segments/:id", () => `/segments/${a.segment}`),
  on("DELETE /stages/:id", () => `/stages/${a.stage}`),
  on("DELETE /tours/:id", () => `/tours/${a.tour}`),
  on("DELETE /tickets/:id", () => `/tickets/${a.ticket}`),
  on("DELETE /kb/:id", () => `/kb/${a.article}`),
  on("DELETE /webhooks/:id", () => `/webhooks/${a.webhook}`),
  on("DELETE /workflows/:id", () => `/workflows/${a.workflow}`),
  on("DELETE /automations/:id", () => `/automations/${a.automation}`),
  on("DELETE /custom-fields/:id", () => `/custom-fields/${a.field}`),
  on("DELETE /waves/:id", () => `/waves/${a.wave}`),
  on("DELETE /regions/:id", () => `/regions/${a.region}`),
  on("DELETE /invitations/:id", () => `/invitations/${a.invitation}`),
  on("DELETE /members/:id", () => `/members/${a.membership}`),
  on("DELETE /roles/:id", () => `/roles/${a.role}`),
  on("DELETE /teams/:id", () => `/teams/${a.team}`),
  on("DELETE /accounts/:id", () => `/accounts/${a.account}`),
  on("POST /leads/bulk-delete", undefined, () => ({ ids: [a.lead2] }), true),
  on("POST /leads/trash/purge", undefined, () => ({ ids: [a.trashed] }), true),
  on("DELETE /leads/:id", () => `/leads/${a.lead}`),
];

/** Routes de lecture ou de liste : la réponse faite à B ne doit rien contenir de A, même en cherchant son nom. */
const LISTS: string[] = [
  "/accounts", "/cms/account", "/cms/sites", "/audit", "/automations", "/contacts", "/custom-fields", "/events?from=2030-01-01T00:00:00.000Z&to=2030-01-31T00:00:00.000Z", "/events/export.ics",
  "/invitations", "/invoices", "/kb", "/leads", "/leads/duplicates", "/leads/trash", "/members", "/me", "/notifications", "/objectives", "/permissions",
  `/quotes/export?format=json`, "/regions", "/reports", "/reports/forecast", "/roles", `/search?q=${MARK}`, "/segments", "/stages", "/tasks?status=all",
  "/teams", "/templates", "/tickets", "/tours", "/waves", "/webhooks", "/workflows", "/health", "/auth/providers",
];

/** Créations et réglages de B dans lesquels il glisse des identifiants de A. */
const SMUGGLE: Attack[] = [
  on("POST /leads", undefined, () => ({ name: "B1", accountId: a.account })),
  on("POST /leads", undefined, () => ({ name: "B2", ownerId: a.member })),
  on("PATCH /leads/:id", () => `/leads/${b.lead}`, () => ({ accountId: a.account })),
  on("PATCH /leads/:id", () => `/leads/${b.lead}`, () => ({ status: `${MARK.slice(0, 30)} e` })),
  on("POST /leads/:id/contacts", () => `/leads/${b.lead}/contacts`, () => ({ name: "c", reportsToId: a.contact })),
  on("PATCH /contacts/:id", () => `/contacts/${b.contact}`, () => ({ reportsToId: a.contact, ownerId: a.member })),
  on("POST /events", undefined, () => ({ title: "e", startsAt: "2030-01-02T10:00:00.000Z", leadId: a.lead })),
  on("POST /tasks", undefined, () => ({ title: "t", leadId: a.lead, ownerId: a.member, assigneeId: a.member })),
  on("PATCH /tasks/:id", () => `/tasks/${b.task}`, () => ({ leadId: a.lead, assigneeId: a.member })),
  on("POST /tickets", undefined, () => ({ title: "t", leadId: a.lead, assigneeId: a.member })),
  on("PATCH /tickets/:id", () => `/tickets/${b.ticket}`, () => ({ leadId: a.lead, assigneeId: a.member })),
  on("POST /waves", undefined, () => ({ regionId: a.region, name: "w", startsOn: "2030-01-01", endsOn: "2030-01-31" })),
  on("POST /automations", undefined, () => ({ kind: "assign", name: "x", params: { userIds: [a.member] } })),
  on("POST /leads/assign", undefined, () => ({ ids: [b.lead], ownerId: a.member })),
  on("POST /members", undefined, () => ({ email: `nobody-${run}@test.dev`, roleIds: [a.sysRole] })),
  on("POST /invitations", undefined, () => ({ email: `i2-${run}@test.dev`, roleIds: [a.role] })),
  on("PUT /members/:id/roles", () => `/members/${b.membership}/roles`, () => ({ roleIds: [a.sysRole] })),
  on("PUT /members/:id/team", () => `/members/${b.membership}/team`, () => ({ teamId: a.team })),
  on("POST /invoices/:id/status", () => `/invoices/${b.invoice}/status`, () => ({ status: "sent" })),
  on("PATCH /workflows/:id", () => `/workflows/${b.workflow}`, () => ({ name: "ok" })),
];

/** Routes publiques ou sans donnée d'entreprise, avec la raison de leur absence ci-dessus. */
const EXEMPT: Record<string, string> = {
  "POST /auth/register": "crée un compte", "POST /auth/login": "ouvre une session", "POST /auth/logout": "ferme sa session",
  "POST /auth/forgot": "public", "POST /auth/reset": "jeton à usage unique", "GET /auth/:provider": "OAuth", "GET /auth/:provider/callback": "OAuth",
  "GET /auth/google": "OAuth", "GET /auth/google/callback": "OAuth", "GET /auth/github": "OAuth", "GET /auth/github/callback": "OAuth",
  "POST /invitations/accept": "jeton secret", "POST /invitations/preview": "jeton secret", "POST /public/contact": "public", "POST /public/feedback": "public",
  "POST /cms/account": "ouvre son propre espace", "POST /cms/sites": "crée chez soi",
  "POST /companies": "crée sa propre entreprise", "PATCH /company": "agit sur l'entreprise de la session (en-tête éprouvé plus bas)",
  "PATCH /me/preferences": "ses propres réglages", "POST /accounts": "crée chez soi", "POST /custom-fields": "crée chez soi", "POST /regions": "crée chez soi",
  "POST /roles": "crée chez soi", "POST /segments": "crée chez soi", "POST /stages": "crée chez soi", "POST /teams": "crée chez soi",
  "POST /templates": "crée chez soi", "POST /kb": "crée chez soi", "POST /webhooks": "crée chez soi", "POST /workflows": "crée chez soi",
  "POST /leads/import": "crée chez soi", "POST /locate": "ne lit aucune donnée enregistrée", "POST /leads/locate-missing": "agit sur ses leads seulement",
};

const listPath = (u: string) => u.split("?")[0];
const urlOf = (x: Attack) => (x.url ? x.url() : x.route.split(" ")[1]);
const send = (s: Partial<S>, x: Attack, companyId?: string) => {
  const method = x.route.split(" ")[0];
  return http(s, method, urlOf(x), method === "GET" || method === "DELETE" ? undefined : (x.body?.() ?? {}), companyId ?? s.companyId);
};
/**
 * Les lignes qui mentionnent A (identifiant ou nom), parmi celles des deux entreprises du test. La base de test est
 * partagée et grossit d'une exécution à l'autre : on ne la parcourt pas en entier.
 */
async function rowsAboutA(): Promise<string[]> {
  const pattern = [MARK, A.companyId, A.userId, ...Object.values(a)].join("|");
  const both = [A.companyId, B.companyId];
  const tables = await client<{ t: string; scoped: boolean }[]>`
    select t.tablename as t, exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.tablename and c.column_name = 'company_id') as scoped
    from pg_tables t where t.schemaname = 'public' and t.tablename <> 'sessions'`;
  const out: string[] = [];
  for (const { t, scoped } of tables) {
    // les tables sans colonne d'entreprise sont reliées aux deux entreprises par une jointure
    const mine = client`(select m.id from memberships m where m.company_id = any(${both}))`;
    const only = scoped
      ? client`x.company_id = any(${both})`
      : t === "companies"
        ? client`x.id = any(${both})`
        : t === "users"
          ? client`x.id in (select m.user_id from memberships m where m.company_id = any(${both}))`
          : t === "membership_roles"
            ? client`x.membership_id in ${mine}`
            : t === "role_permissions"
              ? client`x.role_id in (select id from roles where company_id = any(${both}))`
              : client`true`;
    const rows = await client<{ r: string }[]>`select to_jsonb(x)::text as r from ${client(t)} x where ${only} and to_jsonb(x)::text ~ ${pattern}`;
    out.push(...rows.map((row) => `${t} ${row.r}`));
  }
  return out;
}
const diff = (before: string[], after: string[]) => {
  const was = new Set(before);
  const is = new Set(after);
  return [...after.filter((r) => !was.has(r)).map((r) => `+ ${r}`), ...before.filter((r) => !is.has(r)).map((r) => `- ${r}`)].map((r) => r.slice(0, 220));
};
const leaks = (res: Res) => res.text.includes(MARK);

// la base de test grossit d’une exécution à l’autre : la parcourir prend du temps
describe("isolation entre entreprises", { timeout: 180_000 }, () => {
  it("chaque route de l'API est éprouvée ou explicitement exemptée", () => {
    const covered = new Set([...ATTACKS, ...SMUGGLE].map((x) => x.route).concat(LISTS.map((u) => `GET ${listPath(u)}`), Object.keys(EXEMPT)));
    expect([...routes].filter((r) => !covered.has(r)).sort()).toEqual([]);
  });

  it("B ne lit, ne modifie et ne supprime rien chez A", async () => {
    const before = await rowsAboutA();
    const problems: string[] = [];
    for (const x of ATTACKS) {
      const res = await send(B, x);
      if (res.status >= 500) problems.push(`${x.route} → erreur ${res.status}`);
      else if (!x.soft && res.status < 400) problems.push(`${x.route} → accepté (${res.status})`);
      if (leaks(res)) problems.push(`${x.route} → la réponse contient des données de A`);
    }
    expect(problems).toEqual([]);
    expect(diff(before, await rowsAboutA())).toEqual([]);
  });

  it("les listes, recherches et exports de B ne contiennent rien de A", async () => {
    const problems: string[] = [];
    for (const url of LISTS) {
      const res = await http(B, "GET", url);
      if (res.status >= 400) problems.push(`GET ${url} → ${res.status}`);
      const found = [MARK, A.companyId, a.lead, a.account, a.contact].filter((v) => res.text.includes(v));
      // la recherche peut répéter le mot demandé : il ne doit venir d'aucun résultat
      if (found.length && !(url.startsWith("/search") && found.every((v) => v === MARK) && (res.text.match(new RegExp(MARK, "g")) ?? []).length === 1 && res.text.includes(`"query"`))) problems.push(`GET ${url} → contient ${found.length} donnée(s) de A`);
    }
    expect(problems).toEqual([]);
  });

  it("B ne peut pas rattacher à ses propres données quoi que ce soit de A", async () => {
    const before = await rowsAboutA();
    const problems: string[] = [];
    for (const x of SMUGGLE) {
      const res = await send(B, x);
      if (res.status >= 500) problems.push(`${x.route} ${JSON.stringify(x.body?.())} → erreur ${res.status}`);
    }
    expect(problems).toEqual([]);
    expect(diff(before, await rowsAboutA())).toEqual([]);
  });

  it("se déclarer dans l'entreprise A (en-tête) ou ne pas être connecté est refusé", async () => {
    const company = (x: Attack) => !x.route.includes(" /cms/"); // le CMS ne dépend pas d'une entreprise (couvert par ATTACKS et cms.test.ts)
    const guarded = [...ATTACKS.filter(company), ...LISTS.filter((u) => !["/health", "/auth/providers", "/me"].includes(listPath(u)) && !u.startsWith("/cms/")).map((u) => on(`GET ${listPath(u)}`, () => u)), on("PATCH /company", undefined, () => ({ name: "pris" }))];
    const problems: string[] = [];
    for (const x of guarded) {
      const spoof = await send(B, x, A.companyId);
      if (spoof.status !== 403) problems.push(`${x.route} avec l'en-tête de A → ${spoof.status}`);
      const anonymous = await send({}, x, A.companyId);
      if (anonymous.status !== 401) problems.push(`${x.route} sans session → ${anonymous.status}`);
    }
    expect(problems).toEqual([]);
  });

  it("témoin : A peut, lui, exécuter ces mêmes requêtes", async () => {
    const problems: string[] = [];
    for (const x of ATTACKS) {
      const res = await send(A, x);
      // 409 : refus dû à l'état de l'objet (ex. facture envoyée), la requête a bien été comprise et autorisée
      if (res.status >= 400 && res.status !== 409) problems.push(`${x.route} → ${res.status} ${res.text.slice(0, 120)}`);
    }
    expect(problems).toEqual([]);
  });
});
