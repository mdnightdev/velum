ALTER TABLE "reserves" ADD COLUMN IF NOT EXISTS "currency" varchar(8) DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
UPDATE "reserves" SET "currency" = 'EUR' WHERE "currency" IS NULL OR "currency" = '';
