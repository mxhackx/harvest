CREATE TABLE "tours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"planned_on" date NOT NULL,
	"start_time" text DEFAULT '08:00' NOT NULL,
	"stop_minutes" integer DEFAULT 20 NOT NULL,
	"start" jsonb NOT NULL,
	"end" jsonb,
	"stops" jsonb NOT NULL,
	"legs" jsonb NOT NULL,
	"geometry" jsonb NOT NULL,
	"total_km" double precision DEFAULT 0 NOT NULL,
	"total_min" integer DEFAULT 0 NOT NULL,
	"approximate" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tours_owner" ON "tours" USING btree ("company_id","owner_id","planned_on");--> statement-breakpoint
ALTER TABLE "tours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tours" ADD CONSTRAINT "tours_status_valid" CHECK ("status" IN ('planned', 'done'));
