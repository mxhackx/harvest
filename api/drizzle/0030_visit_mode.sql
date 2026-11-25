ALTER TABLE "leads" ADD COLUMN "visit_mode" text DEFAULT 'onsite' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_visit_mode_valid" CHECK ("visit_mode" IN ('onsite', 'remote'));
