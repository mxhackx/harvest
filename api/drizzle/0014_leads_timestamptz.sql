ALTER TABLE "leads" ALTER COLUMN "closed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "visited_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "updated_at" SET DEFAULT now();