CREATE TABLE IF NOT EXISTS "user_nicknames" (
  "id" serial PRIMARY KEY NOT NULL,
  "owner_id" integer NOT NULL,
  "target_id" integer NOT NULL,
  "nickname" varchar(48) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_nicknames"
    ADD CONSTRAINT "user_nicknames_owner_id_users_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_nicknames"
    ADD CONSTRAINT "user_nicknames_target_id_users_id_fk"
    FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_nicknames_owner_target"
  ON "user_nicknames" USING btree ("owner_id", "target_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_nicknames_owner"
  ON "user_nicknames" USING btree ("owner_id");
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
