import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

/**
 * Une requête qui modifie des données et vient d'un navigateur doit venir d'une de nos adresses (APP_URLS). Indispensable
 * dès que des sites de clients vivent sur un sous-domaine : le navigateur les considère « même site » et joindrait le
 * cookie de session. Sans en-tête Origin (script, serveur), le cookie d'un navigateur n'est pas en jeu : on laisse passer.
 */
export async function checkOrigin(req: FastifyRequest, reply: FastifyReply) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  const origin = req.headers.origin;
  if (origin && !config.appUrls.includes(origin)) return reply.code(403).send({ error: "forbidden_origin" });
}
