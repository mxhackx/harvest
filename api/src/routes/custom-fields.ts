import type { FastifyInstance } from "fastify";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { customFields, leads } from "../db/schema.js";
import type { FieldDef } from "../fields/custom.js";
import { requireMember, requirePermission } from "../plugins/auth.js";

const MAX_FIELDS = 20;
const uuid = z.string().uuid();
const body = z
  .object({
    label: z.string().trim().min(1).max(60),
    type: z.enum(["text", "number", "date", "select"]),
    options: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  })
  .refine((v) => v.type !== "select" || v.options.length >= 2, { message: "une liste a au moins deux choix", path: ["options"] })
  .refine((v) => new Set(v.options.map((o) => o.toLowerCase())).size === v.options.length, { message: "choix en double", path: ["options"] });
const patchBody = z.object({ label: z.string().trim().min(1).max(60).optional(), options: z.array(z.string().trim().min(1).max(60)).max(30).optional() });

export const listFields = (companyId: string): Promise<FieldDef[]> =>
  db.select({ id: customFields.id, label: customFields.label, type: customFields.type, options: customFields.options }).from(customFields).where(eq(customFields.companyId, companyId)).orderBy(asc(customFields.position), asc(customFields.createdAt)) as Promise<FieldDef[]>;

/** Champs personnalisés : tout membre les lit pour afficher ses leads ; les gérer est un droit (`field:*`). */
export async function customFieldRoutes(app: FastifyInstance) {
  app.get("/custom-fields", { preHandler: requireMember }, async (req) => listFields(req.member!.subject.companyId));

  app.post("/custom-fields", { preHandler: requirePermission("field:create") }, async (req, reply) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
    const { companyId } = req.member!.subject;
    const existing = await listFields(companyId);
    if (existing.length >= MAX_FIELDS) return reply.code(409).send({ error: "too_many_fields" });
    if (existing.some((f) => f.label.toLowerCase() === parsed.data.label.toLowerCase())) return reply.code(409).send({ error: "field_exists" });
    const [created] = await db.insert(customFields).values({ ...parsed.data, options: parsed.data.type === "select" ? parsed.data.options : [], companyId, position: existing.length }).returning();
    req.auditLabel = created.label;
    return reply.code(201).send({ id: created.id, label: created.label, type: created.type, options: created.options });
  });

  // Le type d'un champ ne change pas (les valeurs déjà saisies perdraient leur sens) : on renomme, ou on édite les choix.
  app.patch<{ Params: { id: string } }>("/custom-fields/:id", { preHandler: requirePermission("field:update") }, async (req, reply) => {
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
    const { companyId } = req.member!.subject;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [field] = await db.select().from(customFields).where(and(eq(customFields.id, req.params.id), eq(customFields.companyId, companyId)));
    if (!field) return reply.code(404).send({ error: "not_found" });
    if (parsed.data.options && field.type !== "select") return reply.code(400).send({ error: "invalid_body", issues: [{ message: "seule une liste a des choix", path: ["options"] }] });
    if (parsed.data.options && parsed.data.options.length < 2) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "une liste a au moins deux choix", path: ["options"] }] });
    const [updated] = await db.update(customFields).set(parsed.data).where(eq(customFields.id, field.id)).returning();
    req.auditLabel = updated.label;
    return { id: updated.id, label: updated.label, type: updated.type, options: updated.options };
  });

  app.delete<{ Params: { id: string } }>("/custom-fields/:id", { preHandler: requirePermission("field:delete") }, async (req, reply) => {
    const { companyId } = req.member!.subject;
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [field] = await db.select().from(customFields).where(and(eq(customFields.id, req.params.id), eq(customFields.companyId, companyId)));
    if (!field) return reply.code(404).send({ error: "not_found" });
    await db.delete(customFields).where(eq(customFields.id, field.id));
    // les valeurs de ce champ disparaissent des leads
    await db.update(leads).set({ custom: sql`${leads.custom} - ${field.id}` }).where(eq(leads.companyId, companyId));
    req.auditLabel = field.label;
    return reply.code(204).send();
  });
}
