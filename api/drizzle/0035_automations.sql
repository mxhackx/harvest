CREATE TABLE "automation_runs" (
	"automation_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"params" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_unique" ON "automation_runs" USING btree ("automation_id","lead_id");--> statement-breakpoint
CREATE INDEX "automations_company" ON "automations" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "automations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "automation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_kind_valid" CHECK ("kind" IN ('assign', 'task', 'email'));--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission", "scope")
SELECT r."id", p.permission, 'company'::"scope"
FROM "roles" r
CROSS JOIN (VALUES ('automation:read'), ('automation:create'), ('automation:update'), ('automation:delete')) AS p(permission)
WHERE r."is_system" = true AND r."key" IN ('ceo', 'manager')
ON CONFLICT ("role_id", "permission") DO NOTHING;
