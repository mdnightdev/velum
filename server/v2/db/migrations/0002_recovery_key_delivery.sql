ALTER TABLE "users" ADD COLUMN "recovery_key" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_key_delivered" boolean DEFAULT false NOT NULL;
