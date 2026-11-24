CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_id" uuid,
	"entity_label" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_company_time" ON "audit_log" USING btree ("company_id","created_at");--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Le journal est réservé au CEO : on ajoute le droit « audit:read » aux rôles CEO déjà existants.
INSERT INTO "role_permissions" ("role_id", "permission", "scope")
SELECT r."id", 'audit:read', 'company'::"scope"
FROM "roles" r
WHERE r."is_system" = true AND r."key" = 'ceo'
ON CONFLICT ("role_id", "permission") DO NOTHING;
