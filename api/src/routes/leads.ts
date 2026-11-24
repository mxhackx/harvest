import type { FastifyInstance } from "fastify";
import { and, desc, eq, getTableColumns, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { companies, contacts, leads, memberships, notifications, users } from "../db/schema.js";
import { config } from "../config.js";
import { toCsv, toExportRow } from "../leads/export.js";
import { googleMapsField } from "../leads/fields.js";
import { locateInBackground } from "../leads/background.js";
import { allNames, pickUniqueName, takenNames } from "../leads/names.js";
import { cleanRow, duplicateKey, ImportError, makeStatusResolver, MAX_IMPORT_ROWS, parseImport, type CleanRow, type RowIssue } from "../leads/import.js";
import { locate, parseGoogleMapsCoords, type Located } from "../leads/locate.js";
import { can, type Subject } from "../rbac/policy.js";
import { scopeCondition } from "../rbac/sql.js";
import { requireMember, requirePermission } from "../plugins/auth.js";

import { createBody, patchBody } from "../leads/schema.js";
import { logActivities } from "../activities/log.js";
import { alive, findReadableLead, leadAttrs } from "../leads/access.js";
import { TRASH_DAYS, trashLeads } from "../leads/trash.js";
import { ensurePrimaryContact } from "./contacts.js";
import { closingFields, defaultStage, listStages } from "../stages/store.js";

const uuid = z.string().uuid();

/** Portée de lecture ou d'action, hors corbeille (la corbeille a ses propres routes). */
const scopeWhere = (subject: Subject, permission: string) => {
  const scope = scopeCondition(leads, subject, permission);
  return scope && and(scope, alive);
};

const attrs = leadAttrs;
const findLead = findReadableLead;

const logError = (req: { log: { error: (o: object, m: string) => void } }) => (e: unknown) => req.log.error({ err: e }, "activity log failed");

const unknownStage = { error: "invalid_body", issues: [{ message: "étape inconnue", path: ["status"] }] };

const hasCoords = (v: { lat?: number | null; lng?: number | null }) => typeof v.lat === "number" && typeof v.lng === "number";

async function companyRegion(companyId: string) {
  const [c] = await db.select({ region: companies.region }).from(companies).where(eq(companies.id, companyId));
  return c?.region ?? "";
}

const locateBody = z.object({
  googleMapsUrl: googleMapsField.optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
});

const exportBody = z.object({
  format: z.enum(["csv", "json"]),
  delimiter: z.enum([",", ";"]).default(","),
  ids: z.array(uuid).max(5000).optional(),
});

const importBody = z.object({
  content: z.string().max(2_000_000),
  format: z.enum(["csv", "json"]).optional(),
  // par défaut on analyse sans rien écrire : l'utilisateur voit le rapport avant de confirmer
  dryRun: z.boolean().default(true),
});

const bulkIds = z.array(z.string().uuid()).min(1).max(200);
const bulkUpdateBody = z
  .object({ ids: bulkIds, status: z.string().trim().min(1).max(60).optional(), lostReason: z.string().trim().max(200).optional(), visited: z.boolean().optional() })
  .refine((v) => v.status !== undefined || v.visited !== undefined, { message: "rien à modifier" });
const bulkDeleteBody = z.object({ ids: bulkIds });

/** Leads demandés, restreints à l'entreprise ; chacun doit ensuite passer `can()` pour l'action voulue. */
async function loadAllowed(subject: Subject, ids: string[], permission: string, opts: { trashed?: boolean } = {}) {
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.companyId, subject.companyId), opts.trashed ? isNotNull(leads.deletedAt) : alive, inArray(leads.id, [...new Set(ids)])));
  return rows.filter((l) => can(subject, "lead:read", attrs(l)) && can(subject, permission, attrs(l)));
}

export async function leadRoutes(app: FastifyInstance) {
  app.get("/leads", { preHandler: requirePermission("lead:read") }, async (req) => {
    const where = scopeWhere(req.member!.subject, "lead:read")!;
    // « Prochain suivi » : l'échéance la plus proche parmi les tâches ouvertes du lead
    // (colonnes écrites en toutes lettres : Drizzle retire le préfixe de table dans un SELECT à table unique,
    // et « id » serait alors celui des tâches)
    const nextFollowUpAt = sql<string | null>`(select min(t.due_at) from tasks t where t.lead_id = "leads"."id" and t.done_at is null and t.due_at is not null)`.as("next_follow_up_at");
    return db.select({ ...getTableColumns(leads), nextFollowUpAt }).from(leads).where(where).orderBy(desc(leads.createdAt)).limit(1000);
  });

  app.post("/leads", { preHandler: requirePermission("lead:create") }, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const { visited, ...data } = body.data;
    // Responsable : soi-même par défaut ; une autre personne demande le droit d'attribuer (lead:assign) dans la portée de cette personne.
    const wanted = z.object({ ownerId: z.string().uuid().optional() }).safeParse(req.body);
    if (!wanted.success) return reply.code(400).send({ error: "invalid_body", issues: wanted.error.issues });
    let owner = { userId: subject.userId, teamId: subject.teamId, name: req.user!.name };
    if (wanted.data.ownerId && wanted.data.ownerId !== subject.userId) {
      const [target] = await db
        .select({ userId: memberships.userId, teamId: memberships.teamId, name: users.name })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.companyId, subject.companyId), eq(memberships.userId, wanted.data.ownerId)))
        .limit(1);
      if (!target || !can(subject, "lead:assign", { companyId: subject.companyId, ownerId: target.userId, teamId: target.teamId })) {
        return reply.code(400).send({ error: "invalid_body", issues: [{ message: "personne introuvable ou non attribuable", path: ["ownerId"] }] });
      }
      owner = target;
    }
    // Deux leads ne portent jamais exactement le même nom : le suivant devient « Nom (1) », « Nom (2)»…
    data.name = pickUniqueName(data.name, await takenNames(subject.companyId, data.name));
    // Position : celle fournie par l'utilisateur, sinon déduite du lien Google Maps puis de l'adresse,
    // pour que le lead apparaisse sur la carte dès sa création.
    let position: { lat: number | null; lng: number | null; locationSource: string } = {
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      locationSource: hasCoords(data) ? "manual" : "",
    };
    if (!hasCoords(data) && (data.googleMapsUrl || data.address)) {
      const found = await locate({
        googleMapsUrl: data.googleMapsUrl,
        address: data.address,
        city: data.city,
        region: await companyRegion(subject.companyId),
      });
      if (found) position = { lat: found.lat, lng: found.lng, locationSource: found.source };
    }
    // Étape : celle demandée si elle existe dans l'entreprise, sinon la première étape ouverte.
    const stages = await listStages(subject.companyId);
    const stage = data.status ? stages.find((s) => s.key === data.status) : defaultStage(stages);
    if (!stage) return reply.code(400).send(unknownStage);
    const [lead] = await db
      .insert(leads)
      .values({
        ...data,
        ...position,
        status: stage.key,
        ...closingFields(stage, { closedAt: null, lostReason: "" }, data.lostReason),
        companyId: subject.companyId,
        teamId: owner.teamId,
        ownerId: owner.userId,
        visitedAt: visited ? new Date() : null,
      })
      .returning();
    if (lead.contactName) await ensurePrimaryContact(lead.id, subject.companyId, lead.contactName);
    await logActivities([{ companyId: subject.companyId, leadId: lead.id, authorId: subject.userId, kind: "created", meta: { source: "manual", stage: stage.name } }], logError(req));
    if (owner.userId !== subject.userId) {
      await logActivities(
        [{ companyId: subject.companyId, leadId: lead.id, authorId: subject.userId, kind: "assigned", meta: { from: { id: subject.userId, name: req.user!.name }, to: { id: owner.userId, name: owner.name } } }],
        logError(req),
      );
      await db.insert(notifications).values({
        companyId: subject.companyId,
        userId: owner.userId,
        kind: "lead_assigned",
        title: `${req.user!.name} vous a attribué : ${lead.name}`,
        leadId: lead.id,
      });
    }
    return reply.code(201).send(lead);
  });

  // Aide à la saisie : trouve des coordonnées depuis un lien Google Maps ou une adresse.
  app.post(
    "/locate",
    { preHandler: requireMember, config: { rateLimit: { max: config.locateRateLimit, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { subject } = req.member!;
      if (!can(subject, "lead:create") && !can(subject, "lead:update")) return reply.code(403).send({ error: "forbidden" });
      const body = locateBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
      if (!body.data.googleMapsUrl && !body.data.address) return reply.code(400).send({ error: "invalid_body" });
      const found = await locate({ ...body.data, region: await companyRegion(subject.companyId) });
      if (!found) {
        const reason = !config.geocodingEnabled && body.data.address && !body.data.googleMapsUrl ? "geocoding_disabled" : "not_found";
        return { found: false, reason };
      }
      return { found: true, lat: found.lat, lng: found.lng, source: found.source, label: found.label ?? "" };
    },
  );

  // Export : ce que l'utilisateur peut lire ET exporter, éventuellement limité à une liste d'ids.
  app.post("/leads/export", { preHandler: requirePermission("lead:export") }, async (req, reply) => {
    const body = exportBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const readScope = scopeWhere(subject, "lead:read");
    const exportScope = scopeWhere(subject, "lead:export");
    if (!readScope || !exportScope) return reply.code(403).send({ error: "forbidden" });
    const rows = await db
      .select({ lead: leads, owner: users.name })
      .from(leads)
      .innerJoin(users, eq(users.id, leads.ownerId))
      .where(and(readScope, exportScope, body.data.ids ? inArray(leads.id, body.data.ids) : undefined))
      .orderBy(desc(leads.createdAt))
      .limit(10_000);
    const stageNames = new Map((await listStages(subject.companyId)).map((st) => [st.key, st.name]));
    const data = rows.map((r) => toExportRow(r.lead, r.owner, stageNames.get(r.lead.status)));
    const day = new Date().toISOString().slice(0, 10);
    reply.header("content-disposition", `attachment; filename="leads-${day}.${body.data.format}"`);
    reply.header("cache-control", "no-store");
    if (body.data.format === "json") return reply.type("application/json; charset=utf-8").send(JSON.stringify(data, null, 2));
    return reply.type("text/csv; charset=utf-8").send(toCsv(data, body.data.delimiter));
  });

  // Import CSV / JSON : analyse à blanc (dryRun) puis création. Jamais de demi-import silencieux :
  // les lignes invalides et les doublons sont écartés et listés dans le rapport.
  app.post(
    "/leads/import",
    {
      preHandler: requirePermission("lead:create"),
      bodyLimit: 3 * 1024 * 1024,
      config: { rateLimit: { max: config.locateRateLimit, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const body = importBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
      const { subject } = req.member!;

      let parsed;
      try {
        parsed = parseImport(body.data.content, body.data.format);
      } catch (e) {
        if (e instanceof ImportError) return reply.code(400).send({ error: `import_${e.code}`, message: e.message, max: MAX_IMPORT_ROWS });
        throw e;
      }

      const stages = await listStages(subject.companyId);
      const statuses = makeStatusResolver(stages);
      const issues: RowIssue[] = [];
      const rows: CleanRow[] = [];
      for (const rec of parsed.records) {
        const r = cleanRow(rec, statuses);
        if (r.row) rows.push(r.row);
        else issues.push(...r.issues);
      }

      // doublons : contre les leads que l'utilisateur peut voir, et à l'intérieur du fichier
      const known = new Set(
        (await db.select({ name: leads.name, phone: leads.phone, address: leads.address }).from(leads).where(scopeWhere(subject, "lead:read")!)).map(duplicateKey),
      );
      const duplicates: { line: number; name: string }[] = [];
      const fresh: CleanRow[] = [];
      for (const r of rows) {
        const key = duplicateKey(r.data);
        if (known.has(key)) duplicates.push({ line: r.line, name: r.data.name });
        else {
          known.add(key);
          fresh.push(r);
        }
      }

      // Même nom, autre adresse ou autre téléphone : ce n'est pas un doublon, mais le lead est numéroté.
      const taken = new Set(await allNames(subject.companyId));
      let renamed = 0;
      for (const r of fresh) {
        const unique = pickUniqueName(r.data.name, taken);
        if (unique !== r.data.name.trim()) renamed++;
        r.data.name = unique;
        taken.add(unique);
      }

      const invalidLines = new Set(issues.map((i) => i.line));
      const report = {
        dryRun: body.data.dryRun,
        format: parsed.format,
        total: parsed.records.length,
        valid: fresh.length,
        invalid: invalidLines.size,
        duplicates: duplicates.length,
        renamed,
        duplicateLines: duplicates.slice(0, 20),
        errors: issues.slice(0, 100),
        errorsTruncated: issues.length > 100,
        ignoredColumns: parsed.ignoredColumns,
        preview: fresh.slice(0, 5).map((r) => ({
          line: r.line,
          name: r.data.name,
          status: r.data.status ?? defaultStage(stages)?.key ?? "to_visit",
          address: [r.data.address, r.data.city].filter(Boolean).join(", "),
          hasPosition: typeof r.data.lat === "number" || !!(r.data.googleMapsUrl && parseGoogleMapsCoords(r.data.googleMapsUrl)),
          toLocate: typeof r.data.lat !== "number" && !!(r.data.address || r.data.googleMapsUrl),
        })),
        imported: 0,
        locating: 0,
      };
      if (body.data.dryRun || fresh.length === 0) return report;

      const values = fresh.map((r) => {
        const { visited, ...data } = r.data;
        let position: { lat: number | null; lng: number | null; locationSource: string } = { lat: data.lat ?? null, lng: data.lng ?? null, locationSource: typeof data.lat === "number" ? "manual" : "" };
        if (position.lat === null && data.googleMapsUrl) {
          const c = parseGoogleMapsCoords(data.googleMapsUrl); // lecture du lien, sans réseau
          if (c) position = { lat: c.lat, lng: c.lng, locationSource: "google_maps" };
        }
        const stage = stages.find((st) => st.key === data.status) ?? defaultStage(stages);
        return {
          ...data,
          ...position,
          status: stage.key,
          ...closingFields(stage, { closedAt: null, lostReason: "" }, data.lostReason),
          companyId: subject.companyId,
          teamId: subject.teamId,
          ownerId: subject.userId,
          visitedAt: r.visitedAt ?? (visited ? new Date() : null),
        };
      });
      const created = await db.transaction(async (tx) => {
        const out: (typeof leads.$inferSelect)[] = [];
        for (let i = 0; i < values.length; i += 200) out.push(...(await tx.insert(leads).values(values.slice(i, i + 200)).returning()));
        return out;
      });
      report.imported = created.length;
      const withContact = created.filter((l) => l.contactName);
      if (withContact.length) {
        await db.insert(contacts).values(withContact.map((l) => ({ leadId: l.id, companyId: subject.companyId, name: l.contactName, isPrimary: true })));
      }
      await logActivities(
        created.map((l) => ({ companyId: subject.companyId, leadId: l.id, authorId: subject.userId, kind: "created" as const, meta: { source: "import" } })),
        logError(req),
      );

      // adresses et liens courts : recherchés en arrière-plan, sans faire attendre l'utilisateur
      const toLocate = created.filter((l) => l.lat === null && (l.address || l.googleMapsUrl)).map((l) => l.id);
      if (toLocate.length) {
        report.locating = toLocate.length;
        void locateInBackground(toLocate, await companyRegion(subject.companyId), (e) => req.log.error({ err: e }, "background locate failed"));
      }
      return report;
    },
  );

  // Relance la recherche de position des leads qui n'en ont pas (adresse ou lien disponible).
  app.post("/leads/locate-missing", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const { subject } = req.member!;
    const rows = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(scopeWhere(subject, "lead:update")!, isNull(leads.lat), or(ne(leads.address, ""), ne(leads.googleMapsUrl, ""))))
      .limit(300);
    const ids = rows.map((r) => r.id);
    if (ids.length) void locateInBackground(ids, await companyRegion(subject.companyId), (e) => req.log.error({ err: e }, "background locate failed"));
    return reply.code(202).send({ queued: ids.length, geocoding: config.geocodingEnabled });
  });

  // Actions de masse : on applique à ce que les droits permettent, et on dit combien ont été ignorés.
  app.post("/leads/bulk-update", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = bulkUpdateBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const stage = body.data.status ? (await listStages(subject.companyId)).find((st) => st.key === body.data.status) : undefined;
    if (body.data.status && !stage) return reply.code(400).send(unknownStage);
    const allowed = await loadAllowed(subject, body.data.ids, "lead:update");
    if (allowed.length) {
      await db
        .update(leads)
        .set({
          ...(stage
            ? {
                status: stage.key,
                // entrer dans « gagné » / « perdu » date la clôture ; en sortir l'efface (le motif de perte avec)
                closedAt: stage.kind === "open" ? null : sql`coalesce(${leads.closedAt}, now())`,
                lostReason: stage.kind === "lost" ? (body.data.lostReason ?? sql`${leads.lostReason}`) : "",
              }
            : {}),
          ...(body.data.visited === undefined
            ? {}
            : { visitedAt: body.data.visited ? sql`coalesce(${leads.visitedAt}, now())` : null }),
          updatedAt: new Date(),
        })
        .where(inArray(leads.id, allowed.map((l) => l.id)));
      const stages = stage ? await listStages(subject.companyId) : [];
      const name = (key: string) => stages.find((st) => st.key === key)?.name ?? key;
      await logActivities(
        allowed.flatMap((l) => [
          ...(stage && stage.key !== l.status
            ? [{ companyId: subject.companyId, leadId: l.id, authorId: subject.userId, kind: "stage_change" as const, meta: { from: { key: l.status, name: name(l.status) }, to: { key: stage.key, name: stage.name }, ...(stage.kind === "lost" && body.data.lostReason ? { lostReason: body.data.lostReason } : {}) } }]
            : []),
          ...(body.data.visited !== undefined && (l.visitedAt === null) === body.data.visited
            ? [{ companyId: subject.companyId, leadId: l.id, authorId: subject.userId, kind: "visited" as const, meta: { visited: body.data.visited } }]
            : []),
        ]),
        logError(req),
      );
    }
    return { affected: allowed.length, skipped: new Set(body.data.ids).size - allowed.length };
  });

  app.post("/leads/bulk-delete", { preHandler: requirePermission("lead:delete") }, async (req, reply) => {
    const body = bulkDeleteBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const allowed = await loadAllowed(subject, body.data.ids, "lead:delete");
    if (allowed.length) await trashLeads(allowed.map((l) => l.id), subject.userId);
    return { affected: allowed.length, skipped: new Set(body.data.ids).size - allowed.length };
  });

  app.patch<{ Params: { id: string } }>("/leads/:id", { preHandler: requirePermission("lead:update") }, async (req, reply) => {
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const lead = await findLead(subject, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:update", attrs(lead))) return reply.code(403).send({ error: "forbidden" });
    const { visited, ...data } = body.data;
    // Renommer vers un nom déjà pris numérote le lead ; un simple changement de casse reste tel quel.
    if (data.name !== undefined && data.name.trim().toLowerCase() !== lead.name.toLowerCase()) {
      data.name = pickUniqueName(data.name, await takenNames(subject.companyId, data.name, lead.id));
    }
    // Source de la position : fournie à la main → "manual" ; retirée → vide ; sinon on conserve.
    // Si le lead n'a toujours pas de position et qu'on lui donne une adresse ou un lien, on le localise.
    let position: { lat?: number | null; lng?: number | null; locationSource?: string } = {};
    if (hasCoords(data)) position = { locationSource: "manual" };
    else if (data.lat === null && data.lng === null) position = { locationSource: "" };
    else if (lead.lat === null && (data.address !== undefined || data.googleMapsUrl !== undefined || data.city !== undefined)) {
      const found: Located | null = await locate({
        googleMapsUrl: data.googleMapsUrl ?? lead.googleMapsUrl,
        address: data.address ?? lead.address,
        city: data.city ?? lead.city,
        region: await companyRegion(subject.companyId),
      });
      if (found) position = { lat: found.lat, lng: found.lng, locationSource: found.source };
    }
    // Étape : valide, et la date de clôture et le motif de perte suivent le type de l'étape (ouverte, gagnée, perdue).
    let stageFields: { status?: string; closedAt?: Date | null; lostReason?: string } = {};
    if (data.status !== undefined || data.lostReason !== undefined) {
      const stages = await listStages(subject.companyId);
      const target = stages.find((st) => st.key === (data.status ?? lead.status));
      if (!target) return reply.code(400).send(unknownStage);
      stageFields = { status: target.key, ...closingFields(target, lead, data.lostReason) };
    }
    // « Contact » est le nom du contact principal : le saisir crée ou renomme ce contact. Le vider ne le supprime
    // pas (une personne se supprime depuis l'onglet Contacts) : la valeur reste.
    if (data.contactName !== undefined) {
      const name = data.contactName.trim();
      if (name) await ensurePrimaryContact(lead.id, subject.companyId, name);
      else delete data.contactName;
    }
    const [updated] = await db
      .update(leads)
      .set({
        ...data,
        ...stageFields,
        ...position,
        ...(visited === undefined ? {} : { visitedAt: visited ? (lead.visitedAt ?? new Date()) : null }),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id))
      .returning();
    const events: Parameters<typeof logActivities>[0] = [];
    if (updated.status !== lead.status) {
      const stages = await listStages(subject.companyId);
      const name = (key: string) => stages.find((st) => st.key === key)?.name ?? key;
      events.push({
        companyId: subject.companyId,
        leadId: lead.id,
        authorId: subject.userId,
        kind: "stage_change",
        meta: { from: { key: lead.status, name: name(lead.status) }, to: { key: updated.status, name: name(updated.status) }, ...(updated.lostReason ? { lostReason: updated.lostReason } : {}) },
      });
    }
    if ((updated.visitedAt === null) !== (lead.visitedAt === null)) {
      events.push({ companyId: subject.companyId, leadId: lead.id, authorId: subject.userId, kind: "visited", meta: { visited: updated.visitedAt !== null } });
    }
    await logActivities(events, logError(req));
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/leads/:id", { preHandler: requirePermission("lead:delete") }, async (req, reply) => {
    const { subject } = req.member!;
    const lead = await findLead(subject, req.params.id);
    if (!lead) return reply.code(404).send({ error: "not_found" });
    if (!can(subject, "lead:delete", attrs(lead))) return reply.code(403).send({ error: "forbidden" });
    await trashLeads([lead.id], subject.userId);
    return reply.code(204).send();
  });

  // --- Corbeille : on y retrouve ce qu'on a supprimé, pendant 30 jours. Seuls ceux qui peuvent supprimer ces leads la voient.
  app.get("/leads/trash", { preHandler: requirePermission("lead:delete") }, async (req) => {
    const { subject } = req.member!;
    const scope = scopeCondition(leads, subject, "lead:delete")!;
    const rows = await db
      .select({ lead: leads, deletedByName: users.name })
      .from(leads)
      .leftJoin(users, eq(users.id, leads.deletedBy))
      .where(and(scope, isNotNull(leads.deletedAt)))
      .orderBy(desc(leads.deletedAt))
      .limit(500);
    return rows.map(({ lead, deletedByName }) => ({ ...lead, deletedByName, purgeAt: new Date(lead.deletedAt!.getTime() + TRASH_DAYS * 86_400_000) }));
  });

  app.post("/leads/trash/restore", { preHandler: requirePermission("lead:delete") }, async (req, reply) => {
    const body = bulkDeleteBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const allowed = await loadAllowed(subject, body.data.ids, "lead:delete", { trashed: true });
    for (const l of allowed) {
      // le nom a pu être repris depuis la suppression : on renumérote plutôt que de créer un doublon
      const name = pickUniqueName(l.name, await takenNames(subject.companyId, l.name, l.id));
      await db.update(leads).set({ name, deletedAt: null, deletedBy: null, updatedAt: new Date() }).where(eq(leads.id, l.id));
    }
    return { affected: allowed.length, skipped: new Set(body.data.ids).size - allowed.length };
  });

  // Effacement définitif d'une sélection de la corbeille (irréversible : contacts, historique, tâches et événements partent avec).
  app.post("/leads/trash/purge", { preHandler: requirePermission("lead:delete") }, async (req, reply) => {
    const body = bulkDeleteBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });
    const { subject } = req.member!;
    const allowed = await loadAllowed(subject, body.data.ids, "lead:delete", { trashed: true });
    if (allowed.length) await db.delete(leads).where(inArray(leads.id, allowed.map((l) => l.id)));
    return { affected: allowed.length, skipped: new Set(body.data.ids).size - allowed.length };
  });
}
