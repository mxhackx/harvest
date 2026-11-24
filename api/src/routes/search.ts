import type { FastifyInstance } from "fastify";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { contacts, leads, tasks } from "../db/schema.js";
import { alive } from "../leads/access.js";
import { can } from "../rbac/policy.js";
import { requireMember } from "../plugins/auth.js";
import { scopeCondition } from "../rbac/sql.js";

const query = z.object({ q: z.string().trim().min(2).max(100) });
const LIMIT = 8;
/** « 50% » doit chercher « 50% », pas « 50 suivi de n'importe quoi » : on neutralise les jokers LIKE. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Recherche globale : leads, contacts et tâches que la personne a le droit de lire, hors corbeille. */
export async function searchRoutes(app: FastifyInstance) {
  app.get("/search", { preHandler: requireMember }, async (req, reply) => {
    const parsed = query.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_query", issues: parsed.error.issues });
    const { subject } = req.member!;
    const term = `%${likeEscape(parsed.data.q)}%`;

    const leadScope = can(subject, "lead:read") ? scopeCondition(leads, subject, "lead:read") : null;
    const taskScope = can(subject, "task:read") ? scopeCondition(tasks, subject, "task:read") : null;

    const [leadRows, contactRows, taskRows] = await Promise.all([
      leadScope
        ? db
            .select({ id: leads.id, name: leads.name, city: leads.city, sector: leads.sector })
            .from(leads)
            .where(and(leadScope, alive, or(ilike(leads.name, term), ilike(leads.sector, term), ilike(leads.city, term), ilike(leads.address, term), ilike(leads.phone, term), ilike(leads.contactName, term))))
            .orderBy(asc(leads.name))
            .limit(LIMIT)
        : [],
      leadScope
        ? db
            .select({ id: contacts.id, name: contacts.name, email: contacts.email, phone: contacts.phone, leadId: leads.id, leadName: leads.name })
            .from(contacts)
            .innerJoin(leads, eq(leads.id, contacts.leadId))
            .where(and(leadScope, alive, or(ilike(contacts.name, term), ilike(contacts.email, term), ilike(contacts.phone, term), ilike(contacts.whatsapp, term))))
            .orderBy(asc(contacts.name))
            .limit(LIMIT)
        : [],
      taskScope
        ? db
            .select({ id: tasks.id, title: tasks.title, leadId: tasks.leadId })
            .from(tasks)
            .leftJoin(leads, eq(leads.id, tasks.leadId))
            .where(and(taskScope, or(sql`${tasks.leadId} is null`, sql`${leads.deletedAt} is null`)!, ilike(tasks.title, term)))
            .orderBy(asc(tasks.title))
            .limit(LIMIT)
        : [],
    ]);
    return { leads: leadRows, contacts: contactRows, tasks: taskRows };
  });
}
