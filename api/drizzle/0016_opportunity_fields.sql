ALTER TABLE "leads" ADD COLUMN "service" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "probability" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "expected_close_on" date;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;
ALTER TABLE "leads" ADD CONSTRAINT "leads_probability_range" CHECK ("probability" IS NULL OR ("probability" BETWEEN 0 AND 100));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_valid" CHECK ("priority" IN ('low', 'normal', 'high'));
