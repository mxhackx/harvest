import { createHmac, randomBytes, randomUUID } from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { webhooks } from "../db/schema.js";

export const EVENTS = ["lead.created", "lead.updated", "lead.deleted", "wave.closed", "ping"] as const;
export type WebhookEvent = (typeof EVENTS)[number];
/** Après autant d'échecs de suite, le webhook s'éteint (on le réactive en le recréant). */
export const MAX_FAILURES = 10;

export const newSecret = () => `whsec_${randomBytes(24).toString("hex")}`;
/** Signature envoyée dans X-Hivation-Signature : « sha256= » + HMAC du corps brut avec le secret. */
export const sign = (secret: string, body: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

/** Adresse IP privée, locale ou réservée : un webhook ne doit jamais viser le réseau interne du serveur (SSRF). */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

/** L'adresse est-elle acceptable ? https seulement (http local autorisé pour les tests), jamais un hôte privé. */
export async function checkUrl(raw: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "adresse invalide";
  }
  const test = process.env.NODE_ENV === "test";
  if (u.protocol !== "https:" && !(test && u.protocol === "http:")) return "l'adresse doit commencer par https://";
  if (u.username || u.password) return "pas d'identifiants dans l'adresse";
  if (test) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return "adresse interne refusée";
  try {
    const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address);
    if (ips.length === 0 || ips.some(isPrivateIp)) return "adresse interne refusée";
  } catch {
    return "nom de domaine introuvable";
  }
  return null;
}

/** Un envoi : POST JSON signé, 5 s maximum, sans suivre les redirections. Renvoie le code HTTP, ou null si injoignable. */
export async function post(url: string, secret: string, event: string, data: unknown): Promise<number | null> {
  const body = JSON.stringify({ id: randomUUID(), event, createdAt: new Date().toISOString(), data });
  try {
    if (await checkUrl(url)) return null; // revérifié à chaque envoi : le DNS a pu changer depuis la création
    const res = await fetch(url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { "content-type": "application/json", "user-agent": "Hivation-Webhooks/1", "x-hivation-event": event, "x-hivation-signature": sign(secret, body) },
      body,
    });
    return res.status;
  } catch {
    return null;
  }
}

/**
 * Prévient les webhooks de l'entreprise abonnés à cet événement. Ne bloque jamais l'action de l'utilisateur et ne lève
 * jamais d'erreur : un succès remet le compteur d'échecs à zéro, trop d'échecs de suite éteignent le webhook.
 */
export async function emitWebhook(companyId: string, event: WebhookEvent, data: unknown): Promise<void> {
  try {
    const hooks = await db.select().from(webhooks).where(and(eq(webhooks.companyId, companyId), eq(webhooks.active, true)));
    await Promise.all(
      hooks
        .filter((h) => h.events.includes(event))
        .map(async (h) => {
          const status = await post(h.url, h.secret, event, data);
          const ok = status !== null && status >= 200 && status < 300;
          await db
            .update(webhooks)
            .set({ lastStatus: status, lastAt: new Date(), failures: ok ? 0 : sql`${webhooks.failures} + 1`, active: ok ? true : sql`${webhooks.failures} + 1 < ${MAX_FAILURES}` })
            .where(eq(webhooks.id, h.id));
        }),
    );
  } catch {
    /* un webhook en panne ne doit rien casser */
  }
}
