import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { attachments, users } from "../db/schema.js";
import { findReadableLead, leadAttrs } from "../leads/access.js";
import { requirePermission } from "../plugins/auth.js";
import { can, type Subject } from "../rbac/policy.js";
import { MAX_BYTES, MAX_PER_LEAD, TYPES, cleanName, sniff } from "../storage/files.js";
import { getStorage } from "../storage/index.js";

const uuid = z.string().uuid();
const createBody = z.object({
  name: z.string().min(1).max(300),
  size: z.number().int().min(1).max(MAX_BYTES, "50 Mo au plus"),
  type: z.enum(Object.keys(TYPES) as [string, ...string[]], { message: "image ou PDF attendu" }),
});
const unavailable = (reply: FastifyReply) => reply.code(503).send({ error: "storage_unavailable" });
const pub = (a: typeof attachments.$inferSelect, by?: string | null) => ({ id: a.id, name: a.name, type: a.mime, size: a.size, createdAt: a.createdAt, uploadedByName: by ?? null });

/** La pièce jointe et son lead, seulement si la personne peut lire ce lead. */
async function find(subject: Subject, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const [file] = await db.select().from(attachments).where(and(eq(attachments.id, id), eq(attachments.companyId, subject.companyId)));
  const lead = file?.leadId ? await findReadableLead(subject, file.leadId) : null;
  return lead ? { file, lead } : null;
}

/** Pièces jointes d'un lead : le navigateur envoie et télécharge directement auprès du stockage, par des adresses signées. */
export async function attachmentRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/leads/:id/attachments", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const lead = await findReadableLead(req.member!.subject, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    const rows = await db
      .select({ file: attachments, by: users.name })
      .from(attachments)
      .leftJoin(users, eq(users.id, attachments.uploadedBy))
      .where(and(eq(attachments.leadId, lead.id), eq(attachments.ready, true)))
      .orderBy(desc(attachments.createdAt));
    return { enabled: !!getStorage(), items: rows.map((r) => pub(r.file, r.by)) };
  });

  // 1. réserver une place et obtenir l'adresse d'envoi
  app.post<{ Params: { id: string } }>("/leads/:id/attachments", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const lead = await findReadableLead(subject, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:update", leadAttrs(lead))) return reply.code(403).send({ error: "forbidden" });
    const storage = getStorage();
    if (!storage) return unavailable(reply);
    if ((await db.select({ id: attachments.id }).from(attachments).where(eq(attachments.leadId, lead.id))).length >= MAX_PER_LEAD) return reply.code(409).send({ error: "too_many_files" });
    // chaque entreprise a son propre dossier ; le nom saisi n'entre jamais dans le chemin
    const path = `${subject.companyId}/${lead.id}/${randomUUID()}.${TYPES[body.data.type]}`;
    const uploadUrl = await storage.signUpload(path);
    const [created] = await db
      .insert(attachments)
      .values({ companyId: subject.companyId, leadId: lead.id, name: cleanName(body.data.name), mime: body.data.type, size: body.data.size, path, uploadedBy: subject.userId })
      .returning();
    return reply.code(201).send({ id: created.id, uploadUrl });
  });

  // 2. après l'envoi : vérifier ce qui est réellement arrivé
  app.post<{ Params: { id: string } }>("/attachments/:id/complete", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const { subject } = req.member!;
    const found = await find(subject, req.params.id);
    if (!found) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:update", leadAttrs(found.lead))) return reply.code(403).send({ error: "forbidden" });
    const storage = getStorage();
    if (!storage) return unavailable(reply);
    const { file } = found;
    if (file.ready) return pub(file);
    const object = await storage.head(file.path);
    if (!object) return reply.code(409).send({ error: "upload_missing" });
    if (object.size > MAX_BYTES || sniff(object.start) !== file.mime) {
      await storage.remove([file.path]);
      await db.delete(attachments).where(eq(attachments.id, file.id));
      return reply.code(400).send({ error: "file_rejected" });
    }
    const [done] = await db.update(attachments).set({ ready: true, size: object.size }).where(eq(attachments.id, file.id)).returning();
    req.auditLabel = `${done.name} (${found.lead.name})`;
    return pub(done);
  });

  app.get<{ Params: { id: string } }>("/attachments/:id/url", { preHandler: requirePermission("lead:read") }, async (req, reply) => {
    const found = await find(req.member!.subject, req.params.id);
    if (!found || !found.file.ready) return reply.code(404).send({ error: "not_found" });
    const storage = getStorage();
    if (!storage) return unavailable(reply);
    return { url: await storage.signDownload(found.file.path, found.file.name) };
  });

  app.delete<{ Params: { id: string } }>("/attachments/:id", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const { subject } = req.member!;
    const found = await find(subject, req.params.id);
    if (!found) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:update", leadAttrs(found.lead))) return reply.code(403).send({ error: "forbidden" });
    const storage = getStorage();
    if (!storage) return unavailable(reply);
    await storage.remove([found.file.path]);
    await db.delete(attachments).where(eq(attachments.id, found.file.id));
    req.auditLabel = `${found.file.name} (${found.lead.name})`;
    return reply.code(204).send();
  });
}
