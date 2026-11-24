import { sql } from "drizzle-orm";
import {
  date,
  index,
  jsonb,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";

export const scopeEnum = pgEnum("scope", ["own", "team", "company"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // null pour les comptes créés uniquement via Google / GitHub
  passwordHash: text("password_hash"),
  // true une fois l'e-mail prouvé (Google / GitHub). L'inscription par e-mail ne le prouve pas.
  emailVerified: boolean("email_verified").notNull().default(false),
  // photo de profil Google / GitHub ; null → l'interface affiche les initiales
  image: text("image"),
  // reçoit un e-mail pour les tâches et rendez-vous qui arrivent (en plus de la notification dans l'application)
  emailReminders: boolean("email_reminders").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  // sha256 du jeton ; le jeton en clair n'est jamais stocké
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Demande de réinitialisation de mot de passe : jeton haché, valable une heure, à usage unique. */
export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("password_resets_user").on(t.userId)],
);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  region: text("region").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("roles_company_key").on(t.companyId, t.key)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(), // "lead:read"
    scope: scopeEnum("scope").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permission] })],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("memberships_user_company").on(t.userId, t.companyId)],
);

export const membershipRoles = pgTable(
  "membership_roles",
  {
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.membershipId, t.roleId] })],
);

export const stageKindEnum = pgEnum("stage_kind", ["open", "won", "lost"]);

/** Étapes du pipeline, propres à chaque entreprise. Un lead référence l'une d'elles par sa `key`. */
export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    // couleur CSS : « #e5484d » ou « rgba(34, 170, 94, 0.6) » (elle colore aussi le point sur la carte)
    color: text("color").notNull(),
    // chance de conclure à cette étape, en % : sert à pondérer la valeur du pipeline
    probability: integer("probability").notNull().default(0),
    kind: stageKindEnum("kind").notNull().default("open"),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("pipeline_stages_company_key").on(t.companyId, t.key)],
);

/** Zone de prospection : un centre et un rayon. Un lead appartient à la plus proche région qui le contient. */
export const regions = pgTable(
  "regions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    radiusKm: doublePrecision("radius_km").notNull().default(5),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("regions_company").on(t.companyId)],
);

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  // équipe du créateur au moment de la saisie : sert à la portée « team » du RBAC
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  sector: text("sector").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  // repère : « à côté de la pharmacie, 2e étage » — essentiel là où les adresses sont approximatives
  landmark: text("landmark").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  facebook: text("facebook").notNull().default(""),
  website: text("website").notNull().default(""),
  googleMapsUrl: text("google_maps_url").notNull().default(""),
  // d'où vient la position : "" (aucune) | manual | address | google_maps
  locationSource: text("location_source").notNull().default(""),
  contactName: text("contact_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  // clé d'une étape de pipeline_stages (validée par l'API)
  status: text("status").notNull().default("to_visit"),
  lostReason: text("lost_reason").notNull().default(""),
  // date d'entrée dans une étape « gagné » ou « perdu »
  closedAt: timestamp("closed_at", { withTimezone: true }),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  estimatedValue: integer("estimated_value"),
  // opportunité : service demandé, probabilité propre au lead (null = celle de l'étape) et date de conclusion espérée
  service: text("service").notNull().default(""),
  probability: integer("probability"),
  expectedCloseOn: date("expected_close_on", { mode: "string" }),
  // null = pas encore visité (pastille « à visiter » sur la carte)
  visitedAt: timestamp("visited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // corbeille : un lead supprimé est seulement masqué (deletedAt) ; il est effacé pour de bon après 30 jours ou à la demande
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  // région où tombe sa position (déduite des coordonnées, jamais saisie) ; null = hors de toute région ou sans position
  regionId: uuid("region_id").references(() => regions.id, { onDelete: "set null" }),
});

export const eventKindEnum = pgEnum("event_kind", ["visit", "call", "followup", "other"]);

/** Rendez-vous du calendrier : visites, appels, relances. Rattaché ou non à un lead. */
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  // équipe du créateur à la création : sert à la portée « team » du RBAC
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  // un rendez-vous pour un lead supprimé n'a plus de sens
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: eventKindEnum("kind").notNull().default("visit"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  // fin du rendez-vous ; null = durée non précisée (une heure dans le calendrier exporté)
  endsAt: timestamp("ends_at", { withTimezone: true }),
  notes: text("notes").notNull().default(""),
  done: boolean("done").notNull().default(false),
  remindedAt: timestamp("reminded_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Personnes à contacter dans l'entreprise d'un lead. Elles suivent les droits du lead. */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    phone: text("phone").notNull().default(""),
    whatsapp: text("whatsapp").notNull().default(""),
    email: text("email").notNull().default(""),
    notes: text("notes").notNull().default(""),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("contacts_lead").on(t.leadId),
    // un seul contact principal par lead
    uniqueIndex("contacts_one_primary").on(t.leadId).where(sql`${t.isPrimary}`),
  ],
);

export const activityKindEnum = pgEnum("activity_kind", ["note", "call", "message", "visit", "email", "created", "stage_change", "visited", "assigned"]);

/** Fil d'activité d'un lead : ce que l'équipe y a fait (saisi à la main) et ce que le système a enregistré. */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    kind: activityKindEnum("kind").notNull(),
    body: text("body").notNull().default(""),
    // détails des événements système : { from, to, lostReason }, { visited }, { to }…
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    // quand l'action a eu lieu (modifiable pour un appel passé), distinct de la date de saisie
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("activities_lead_time").on(t.leadId, t.occurredAt)],
);

/**
 * Tâche / rappel. `ownerId` est la personne à qui elle est attribuée : les portées own / team / company
 * s'appliquent donc à elle comme pour les leads. `createdBy` garde qui l'a créée.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    // équipe de la personne assignée au moment de l'attribution (portée « team »)
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    // low | normal | high
    priority: text("priority").notNull().default("normal"),
    // rappel déjà envoyé pour cette échéance (remis à zéro quand l'échéance change)
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("tasks_owner_open").on(t.companyId, t.ownerId, t.doneAt, t.dueAt), index("tasks_lead").on(t.leadId)],
);

/** Notification personnelle : une attribution de tâche ou de lead. Les retards se calculent à la volée, pas ici. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("notifications_user").on(t.userId, t.companyId, t.readAt, t.createdAt)],
);

/**
 * Invitation à rejoindre une entreprise. Le jeton n'est jamais stocké : seule son empreinte l'est, comme pour les
 * sessions. Il est affiché une seule fois à la personne qui invite, qui transmet le lien.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    roleIds: uuid("role_ids").array().notNull(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("invitations_token").on(t.tokenHash), index("invitations_company").on(t.companyId)],
);

/** Modèle de message réutilisable (WhatsApp, e-mail). Partagé dans l'entreprise ; `{{contact}}`, `{{entreprise}}`, `{{moi}}` sont remplacés à l'envoi. */
export const messageTemplates = pgTable(
  "message_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    channel: text("channel").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("message_templates_name").on(t.companyId, sql`lower(${t.name})`)],
);

/** Vue de leads enregistrée par une personne : recherche, filtres et tri de la page Leads. Personnelle. */
export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    config: jsonb("config").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("segments_user_name").on(t.companyId, t.userId, sql`lower(${t.name})`)],
);

/**
 * Journal d'audit : qui a fait quoi, quand. Une ligne par action qui modifie des données (jamais le contenu des requêtes :
 * ni mots de passe, ni jetons). `entityLabel` garde le nom de l'objet (ex. le lead supprimé) même s'il n'existe plus.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    // « DELETE /leads/:id » : la route appelée ; l'interface la traduit en phrase
    action: text("action").notNull(),
    entityId: uuid("entity_id"),
    entityLabel: text("entity_label").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_company_time").on(t.companyId, t.createdAt)],
);

/**
 * Vague : une région couverte pendant une période, avec un objectif de visites. Clôturée, elle garde son bilan
 * (visités, convertis, à repasser) tel qu'il était ce jour-là.
 */
export const waves = pgTable(
  "waves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    name: text("name").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    targetVisits: integer("target_visits").notNull().default(0),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    bilan: jsonb("bilan").$type<{ total: number; visited: number; converted: number; toRevisit: number; targetVisits: number }>(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("waves_company").on(t.companyId, t.startsOn)],
);

/**
 * E-mails envoyés depuis le CRM : qui a écrit à qui, quand, avec quel résultat. Les réponses arrivent dans la boîte
 * de la personne qui écrit (reply-to) : le CRM n'a pas de boîte de réception. Effacés avec le contact (RGPD).
 */
export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    sentBy: uuid("sent_by").references(() => users.id, { onDelete: "set null" }),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    // sent | failed
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("email_log_lead").on(t.leadId, t.createdAt)],
);
