ALTER TABLE "contacts" ADD COLUMN "salutation" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "first_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "last_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "reports_to_id" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "country" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "street" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "city" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "region" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "postal_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_reports_to_id_contacts_id_fk" FOREIGN KEY ("reports_to_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- les contacts existants n ont qu un nom : il devient leur nom de famille
UPDATE "contacts" SET "last_name" = "name" WHERE "last_name" = '';
