import {
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

export const leadStatusEnum = pgEnum("lead_status", ["to_visit", "interested", "mockup_sent", "deposit_paid"]);

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
  status: leadStatusEnum("status").notNull().default("to_visit"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  estimatedValue: integer("estimated_value"),
  // null = pas encore visité (pastille « à visiter » sur la carte)
  visitedAt: timestamp("visited_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  notes: text("notes").notNull().default(""),
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
