CREATE TYPE "public"."stage_kind" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"kind" "stage_kind" DEFAULT 'open' NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- l'ancienne valeur par défaut est typée « lead_status » : on l'enlève avant de convertir la colonne
ALTER TABLE "leads" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'to_visit';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lost_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_stages_company_key" ON "pipeline_stages" USING btree ("company_id","key");--> statement-breakpoint
DROP TYPE "public"."lead_status";