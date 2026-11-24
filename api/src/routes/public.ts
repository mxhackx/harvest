import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { contactMessages, docFeedback } from "../db/schema.js";
import { sendMail } from "../mail/send.js";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// seules les pages de la documentation reçoivent des avis (évite de remplir la base avec n'importe quoi)
const docPage = z.string().regex(/^\/docs(\/[a-z0-9-]+)*$/).max(100);

const contactBody = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  message: z.string().trim().min(5).max(3000),
  page: docPage.optional().default("/docs"),
  // champ piège : invisible pour une personne, rempli par la plupart des robots
  website: z.string().max(200).optional(),
});
const feedbackBody = z.object({ page: docPage, rating: z.number().int().min(1).max(3) });

const contactRate = { rateLimit: { max: process.env.NODE_ENV === "test" ? 1000 : 5, timeWindow: "1 hour" } };
const feedbackRate = { rateLimit: { max: process.env.NODE_ENV === "test" ? 1000 : 30, timeWindow: "1 hour" } };

/** Routes publiques de la documentation : message de contact et avis sur un article. Sans compte, limitées par adresse IP. */
export async function publicRoutes(app: FastifyInstance) {
  app.post("/public/contact", { config: contactRate }, async (req, reply) => {
    const body = contactBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    // un robot a rempli le champ piège : on répond « reçu » sans rien garder
    if (body.data.website) return reply.code(202).send({ ok: true });
    await db.insert(contactMessages).values({ email: body.data.email, message: body.data.message, page: body.data.page });
    if (config.supportEmail) {
      await sendMail(
        {
          to: config.supportEmail,
          subject: `Message depuis la documentation (${body.data.page})`,
          text: `De : ${body.data.email}\nPage : ${body.data.page}\n\n${body.data.message}\n`,
          html: `<p><strong>De :</strong> ${esc(body.data.email)}<br><strong>Page :</strong> ${esc(body.data.page)}</p><div style="white-space:pre-wrap">${esc(body.data.message)}</div>`,
          replyTo: body.data.email,
        },
        req.log,
      );
    }
    return reply.code(202).send({ ok: true });
  });

  app.post("/public/feedback", { config: feedbackRate }, async (req, reply) => {
    const body = feedbackBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    await db.insert(docFeedback).values(body.data);
    return reply.code(204).send();
  });
}
