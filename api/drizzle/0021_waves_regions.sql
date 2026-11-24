CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"radius_km" double precision DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"target_visits" integer DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	"bilan" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "region_id" uuid;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waves" ADD CONSTRAINT "waves_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waves" ADD CONSTRAINT "waves_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waves" ADD CONSTRAINT "waves_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "regions_company" ON "regions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "waves_company" ON "waves" USING btree ("company_id","starts_on");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "waves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_radius_range" CHECK ("radius_km" > 0 AND "radius_km" <= 500);--> statement-breakpoint
ALTER TABLE "waves" ADD CONSTRAINT "waves_period_valid" CHECK ("ends_on" >= "starts_on");--> statement-breakpoint
-- CEO et Manager gèrent les régions et les vagues ; les autres rôles les consultent seulement.
INSERT INTO "role_permissions" ("role_id", "permission", "scope")
SELECT r."id", p.permission, 'company'::"scope"
FROM "roles" r
CROSS JOIN (VALUES ('wave:create'), ('wave:update'), ('wave:delete')) AS p(permission)
WHERE r."is_system" = true AND r."key" IN ('ceo', 'manager')
ON CONFLICT ("role_id", "permission") DO NOTHING;
