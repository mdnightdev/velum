ALTER TABLE "messages" ADD COLUMN "delivered_to" text DEFAULT '';
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "read_by" text DEFAULT '';
