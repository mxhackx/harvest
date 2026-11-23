import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { loadUser } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { companyRoutes } from "./routes/companies.js";
import { roleRoutes } from "./routes/roles.js";
import { memberRoutes } from "./routes/members.js";
import { leadRoutes } from "./routes/leads.js";
import { eventRoutes } from "./routes/events.js";

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? true, trustProxy: config.isProd });

  await app.register(cors, {
    origin: config.appUrls,
    credentials: true,
    allowedHeaders: ["content-type", "x-company-id"],
    // sans cela le navigateur cache le nom de fichier proposé par l'export
    exposedHeaders: ["content-disposition"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.decorateRequest("user", null);
  app.decorateRequest("member", null);
  app.addHook("onRequest", loadUser);

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(authRoutes);
  await app.register(companyRoutes);
  await app.register(roleRoutes);
  await app.register(memberRoutes);
  await app.register(leadRoutes);
  await app.register(eventRoutes);
  return app;
}
