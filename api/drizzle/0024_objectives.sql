CREATE TABLE "objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"month" date NOT NULL,
	"target_visits" integer DEFAULT 0 NOT NULL,
	"target_won" integer DEFAULT 0 NOT NULL,
	"target_value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "objectives_unique" ON "objectives" USING btree ("company_id","user_id","month");--> statement-breakpoint
ALTER TABLE "objectives" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission", "scope")
SELECT r."id", 'objective:update', 'company'::"scope"
FROM "roles" r
WHERE r."is_system" = true AND r."key" IN ('ceo', 'manager')
ON CONFLICT ("role_id", "permission") DO NOTHING;
