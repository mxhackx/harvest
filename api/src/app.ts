import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { loadUser } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { passwordResetRoutes } from "./routes/password-reset.js";
import { companyRoutes } from "./routes/companies.js";
import { roleRoutes } from "./routes/roles.js";
import { memberRoutes } from "./routes/members.js";
import { leadRoutes } from "./routes/leads.js";
import { auditRoutes } from "./routes/audit.js";
import { regionRoutes } from "./routes/regions.js";
import { waveRoutes } from "./routes/waves.js";
import { emailRoutes } from "./routes/emails.js";
import { searchRoutes } from "./routes/search.js";
import { duplicateRoutes } from "./routes/duplicates.js";
import { objectiveRoutes } from "./routes/objectives.js";
import { customFieldRoutes } from "./routes/custom-fields.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { publicRoutes } from "./routes/public.js";
import { accountRoutes } from "./routes/accounts.js";
import { quoteRoutes } from "./routes/quotes.js";
import { tourRoutes } from "./routes/tours.js";
import { invoiceRoutes } from "./routes/invoices.js";
import { automationRoutes } from "./routes/automations.js";
import { auditHook } from "./audit/record.js";
import { eventRoutes } from "./routes/events.js";
import { stageRoutes } from "./routes/stages.js";
import { contactRoutes } from "./routes/contacts.js";
import { activityRoutes } from "./routes/activities.js";
import { invitationRoutes } from "./routes/invitations.js";
import { leadAssignRoutes } from "./routes/lead-assign.js";
import { reportRoutes } from "./routes/reports.js";
import { segmentRoutes } from "./routes/segments.js";
import { templateRoutes } from "./routes/templates.js";
import { taskRoutes } from "./routes/tasks.js";
import { notificationRoutes } from "./routes/notifications.js";

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
  app.addHook("onResponse", auditHook);

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(authRoutes);
  await app.register(passwordResetRoutes);
  await app.register(companyRoutes);
  await app.register(roleRoutes);
  await app.register(memberRoutes);
  await app.register(leadRoutes);
  await app.register(eventRoutes);
  await app.register(stageRoutes);
  await app.register(contactRoutes);
  await app.register(activityRoutes);
  await app.register(taskRoutes);
  await app.register(templateRoutes);
  await app.register(segmentRoutes);
  await app.register(reportRoutes);
  await app.register(invitationRoutes);
  await app.register(leadAssignRoutes);
  await app.register(notificationRoutes);
  await app.register(auditRoutes);
  await app.register(regionRoutes);
  await app.register(waveRoutes);
  await app.register(emailRoutes);
  await app.register(searchRoutes);
  await app.register(duplicateRoutes);
  await app.register(objectiveRoutes);
  await app.register(customFieldRoutes);
  await app.register(webhookRoutes);
  await app.register(publicRoutes);
  await app.register(accountRoutes);
  await app.register(quoteRoutes);
  await app.register(tourRoutes);
  await app.register(invoiceRoutes);
  await app.register(automationRoutes);
  return app;
}
