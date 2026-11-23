import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { PNG } from "pngjs";

export const API = "http://localhost:4100";

export type User = { email: string; cookie: string; companyId?: string };

const run = Math.random().toString(36).slice(2, 8);
let counter = 0;
export const uniqueEmail = (prefix = "e2e") => `${prefix}-${run}-${counter++}@e2e.test`;

/** Crée un compte (et, par défaut, son entreprise) directement par l'API : rapide et indépendant de l'interface. */
export async function newUser(request: APIRequestContext, opts: { company?: boolean; name?: string } = {}): Promise<User> {
  const email = uniqueEmail();
  const res = await request.post(`${API}/auth/register`, { data: { email, name: opts.name ?? "Aris Hazoume", password: "motdepasse-ok" } });
  if (res.status() !== 201) throw new Error(`inscription impossible : ${res.status()} ${await res.text()}`);
  const cookie = /harvest_session=([^;]+)/.exec(res.headers()["set-cookie"] ?? "")![1];
  const user: User = { email, cookie };
  if (opts.company !== false) {
    const c = await request.post(`${API}/companies`, {
      headers: { cookie: `harvest_session=${cookie}` },
      data: { name: "Atelier Démo", sector: "Commerce", region: "Cotonou", teamName: "Équipe 1" },
    });
    user.companyId = (await c.json()).company.id;
  }
  return user;
}

export async function call<T = unknown>(request: APIRequestContext, user: User, method: "get" | "post" | "patch" | "delete", path: string, data?: unknown): Promise<T> {
  const res = await request[method](`${API}${path}`, {
    headers: { cookie: `harvest_session=${user.cookie}`, ...(user.companyId ? { "x-company-id": user.companyId } : {}) },
    data,
  });
  if (!res.ok() && res.status() !== 204) throw new Error(`${method} ${path} → ${res.status()} ${await res.text()}`);
  return (res.status() === 204 ? undefined : await res.json()) as T;
}

export type LeadSeed = Record<string, unknown> & { name: string };
export const addLead = (request: APIRequestContext, user: User, lead: LeadSeed) => call<{ id: string; name: string }>(request, user, "post", "/leads", lead);

/** Connecte le navigateur avec la session d'un utilisateur créé par l'API. */
export async function signIn(context: BrowserContext, user: User) {
  await context.addCookies([{ name: "harvest_session", value: user.cookie, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
}

/** Ajoute un membre avec un rôle système à l'entreprise du CEO, et renvoie ses identifiants. */
export async function addMember(request: APIRequestContext, ceo: User, roleKey: "manager" | "prospecteur" | "affilie" | "worker"): Promise<User> {
  const member = await newUser(request, { company: false, name: `Membre ${roleKey}` });
  const roles = await call<{ id: string; key: string }[]>(request, ceo, "get", "/roles");
  await call(request, ceo, "post", "/members", { email: member.email, roleIds: [roles.find((r) => r.key === roleKey)!.id] });
  return { ...member, companyId: ceo.companyId };
}

/** Pixels d'une couleur dans une capture : sert à vérifier ce que dessine la carte (canevas WebGL, illisible autrement). */
export function pixelsOfColor(png: Buffer, rgb: [number, number, number], tolerance = 8) {
  const { data, width, height } = PNG.sync.read(png);
  const hits: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 200 && Math.abs(data[i] - rgb[0]) <= tolerance && Math.abs(data[i + 1] - rgb[1]) <= tolerance && Math.abs(data[i + 2] - rgb[2]) <= tolerance) hits.push({ x, y });
    }
  const cx = hits.reduce((s, p) => s + p.x, 0) / (hits.length || 1);
  const cy = hits.reduce((s, p) => s + p.y, 0) / (hits.length || 1);
  return { count: hits.length, center: { x: cx, y: cy } };
}

/** Attend que la carte ait dessiné ses fonds de carte et ses points. */
export async function mapReady(page: Page) {
  await page.locator("canvas").first().waitFor();
  await page.waitForTimeout(3500);
}

export const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Les bandeaux de l'application. Next.js a aussi un `role="alert"` (annonce de navigation) : on l'écarte. */
export const banner = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

const DB = process.env.E2E_DATABASE_URL ?? "postgres://harvest:harvest@localhost:54329/harvest_test";

/** Vieillit un lead directement en base : l'API date toujours la création « maintenant ». */
export function backdateLead(id: string, days: number) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("identifiant de lead invalide");
  execFileSync("psql", [DB, "-qtAc", `update leads set created_at = now() - interval '${Math.trunc(days)} days' where id = '${id}'`]);
}
