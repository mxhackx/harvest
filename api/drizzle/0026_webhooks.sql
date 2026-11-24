CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"last_status" integer,
	"last_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhooks_company" ON "webhooks" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "webhooks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission", "scope")
SELECT r."id", p.permission, 'company'::"scope"
FROM "roles" r
CROSS JOIN (VALUES ('webhook:read'), ('webhook:create'), ('webhook:delete')) AS p(permission)
WHERE r."is_system" = true AND r."key" = 'ceo'
ON CONFLICT ("role_id", "permission") DO NOTHING;
