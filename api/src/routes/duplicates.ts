import type { FastifyInstance } from "fastify";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { activities, contacts, emailLog, events, leads, tasks } from "../db/schema.js";
import { alive, leadAttrs } from "../leads/access.js";
import { FILLABLE, findDuplicateGroups } from "../leads/duplicates.js";
import { can } from "../rbac/policy.js";
import { requirePermission } from "../plugins/auth.js";
import { scopeCondition } from "../rbac/sql.js";
import { assignRegions } from "../waves/geo.js";
import { syncLeadContactName } from "./contacts.js";

const mergeBody = z.object({ keepId: z.string().uuid(), mergeIds: z.array(z.string().uuid()).min(1).max(5) });

/** Doublons : repérer les leads qui semblent identiques, et les fusionner en un seul sans rien perdre. */
export async function duplicateRoutes(app: FastifyInstance) {
  app.get("/leads/duplicates", { preHandler: requirePermission("lead:delete") }, async (req) => {
    const { subject } = req.member!;
    const scope = scopeCondition(leads, subject, "lead:delete")!;
    const rows = await db
      .select({ id: leads.id, name: leads.name, city: leads.city, phone: leads.phone, status: leads.status, createdAt: leads.createdAt })
      .from(leads)
      .where(and(scope, alive))
      .limit(5000);
    const byId = new Map(rows.map((r) => [r.id, r]));
    return findDuplicateGroups(rows)
      .slice(0, 50)
      .map((g) => ({ reason: g.reason, leads: g.ids.map((id) => byId.get(id)!).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) }));
  });

  // Fusion : contacts, historique, tâches, rendez-vous et e-mails passent au lead gardé ; ses champs vides sont complétés ;
  // les doublons disparaissent (leur contenu est déjà déplacé). Irréversible : il faut pouvoir modifier et supprimer chaque lead.
  app.post("/leads/merge", { preHandler: requirePermission("lead:delete") }, async (req, reply) => {
    const body = mergeBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { keepId, mergeIds } = body.data;
    if (mergeIds.includes(keepId)) return reply.code(400).send({ error: "invalid_body", issues: [{ message: "le lead gardé ne peut pas être fusionné avec lui-même", path: ["mergeIds"] }] });
    const { subject } = req.member!;
    const rows = await db
      .select()
      .from(leads)
      .where(and(eq(leads.companyId, subject.companyId), alive, inArray(leads.id, [keepId, ...mergeIds])));
    const keep = rows.find((l) => l.id === keepId);
    const others = rows.filter((l) => l.id !== keepId);
    const allowed = (l: (typeof rows)[number]) => can(subject, "lead:read", leadAttrs(l)) && can(subject, "lead:update", leadAttrs(l)) && can(subject, "lead:delete", leadAttrs(l));
    if (!keep || others.length !== new Set(mergeIds).size || !rows.every(allowed)) return reply.code(404).send({ error: "not_found" });

    const ids = others.map((l) => l.id);
    await db.transaction(async (tx) => {
      // un seul contact principal par lead : ceux qui arrivent ne le sont plus
      await tx.update(contacts).set({ isPrimary: false }).where(inArray(contacts.leadId, ids));
      await tx.update(contacts).set({ leadId: keepId }).where(inArray(contacts.leadId, ids));
      await tx.update(activities).set({ leadId: keepId }).where(inArray(activities.leadId, ids));
      await tx.update(tasks).set({ leadId: keepId }).where(inArray(tasks.leadId, ids));
      await tx.update(events).set({ leadId: keepId }).where(inArray(events.leadId, ids));
      await tx.update(emailLog).set({ leadId: keepId }).where(inArray(emailLog.leadId, ids));
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      for (const f of FILLABLE) {
        if (keep[f] === "") patch[f] = others.map((o) => o[f]).find((v) => v !== "") ?? "";
      }
      if (keep.lat === null || keep.lng === null) {
        const withPos = others.find((o) => o.lat !== null && o.lng !== null);
        if (withPos) Object.assign(patch, { lat: withPos.lat, lng: withPos.lng, locationSource: withPos.locationSource });
      }
      if (keep.estimatedValue === null) patch.estimatedValue = others.find((o) => o.estimatedValue !== null)?.estimatedValue ?? null;
      await tx.update(leads).set(patch).where(eq(leads.id, keepId));
      await tx.insert(activities).values({ companyId: subject.companyId, leadId: keepId, authorId: subject.userId, kind: "note", body: `Fusion : ${others.map((o) => `« ${o.name} »`).join(", ")} fusionné${others.length > 1 ? "s" : ""} dans ce lead.` });
      await tx.delete(leads).where(inArray(leads.id, ids));
    });
    await syncLeadContactName(keepId);
    await assignRegions(subject.companyId, [keepId]);
    req.auditLabel = `${keep.name} ← ${others.map((o) => o.name).join(", ")}`.slice(0, 200);
    return { kept: keepId, merged: ids.length };
  });
}
