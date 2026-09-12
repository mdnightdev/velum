ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "currency" varchar(8) DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
UPDATE "listings" SET "currency" = 'EUR' WHERE "currency" IS NULL OR "currency" = '';--> statement-breakpoint
ALTER TABLE "escrows" ADD COLUMN IF NOT EXISTS "currency" varchar(8) DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "escrows" ADD COLUMN IF NOT EXISTS "payment_currency" varchar(8) DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "escrows" ADD COLUMN IF NOT EXISTS "payment_amount" numeric(18, 2);--> statement-breakpoint
UPDATE "escrows" SET "payment_amount" = "amount" WHERE "payment_amount" IS NULL;--> statement-breakpoint
ALTER TABLE "escrows" ALTER COLUMN "payment_amount" SET NOT NULL;
