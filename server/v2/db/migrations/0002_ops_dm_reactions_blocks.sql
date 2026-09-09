-- Missing tables / constraints not captured in 0000 (ops, DM reactions, blocks).
-- All statements are idempotent (IF NOT EXISTS) so re-runs are safe.

CREATE TABLE IF NOT EXISTS "dms" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender" integer NOT NULL,
	"peer" integer NOT NULL,
	"body" text NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"reply_to" integer,
	"read_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dms" ADD CONSTRAINT "dms_sender_users_id_fk" FOREIGN KEY ("sender") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dms" ADD CONSTRAINT "dms_peer_users_id_fk" FOREIGN KEY ("peer") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dms_pair" ON "dms" USING btree ("sender","peer");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dms_peer_sender" ON "dms" USING btree ("peer","sender");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dms_created" ON "dms" USING btree ("created");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "dm_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dm_reactions" ADD CONSTRAINT "dm_reactions_message_id_dms_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."dms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dm_reactions" ADD CONSTRAINT "dm_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
-- Prefer unique INDEX (idempotent) over truncate+CONSTRAINT; one existing row is fine.
CREATE UNIQUE INDEX IF NOT EXISTS "unique_dm_user_emoji" ON "dm_reactions" USING btree ("message_id","user_id","emoji");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dm_reactions_message" ON "dm_reactions" USING btree ("message_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "dm_clears" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"peer" integer NOT NULL,
	"last_id" integer DEFAULT 0 NOT NULL,
	"updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dm_clears" ADD CONSTRAINT "dm_clears_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dm_clears" ADD CONSTRAINT "dm_clears_peer_users_id_fk" FOREIGN KEY ("peer") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_dm_clears_user_peer" ON "dm_clears" USING btree ("user_id","peer");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dm_clears_user" ON "dm_clears" USING btree ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ops_error_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar(64) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"code" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"route" varchar(256),
	"method" varchar(16),
	"status_code" integer,
	"user_id" integer,
	"correlation_id" varchar(64),
	"component" varchar(128),
	"details_json" text,
	"stack" text,
	"resolved" varchar(16) DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "ops_error_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ops_errors_severity" ON "ops_error_events" USING btree ("severity");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ops_errors_created" ON "ops_error_events" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ops_errors_resolved" ON "ops_error_events" USING btree ("resolved");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "client_diagnostics" (
	"id" serial PRIMARY KEY NOT NULL,
	"log_id" varchar(64) NOT NULL,
	"user_id" integer,
	"username" varchar(128),
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"app_version" varchar(64),
	"ip_address" varchar(64),
	"screen_resolution" varchar(32),
	"device_pixel_ratio" real,
	"viewport_size" varchar(32),
	"online_status" boolean,
	"connection_type" varchar(32),
	"user_agent" text,
	"notes" text,
	"payload_json" text,
	"severity" varchar(16) DEFAULT 'red',
	"source" varchar(32) DEFAULT 'manual',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "client_diagnostics_log_id_unique" UNIQUE("log_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_diag_created" ON "client_diagnostics" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_diag_status" ON "client_diagnostics" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_client_diag_user" ON "client_diagnostics" USING btree ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "heal_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" varchar(64) NOT NULL,
	"mode" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"summary" text NOT NULL,
	"findings_json" text,
	"actions_json" text,
	"triggered_by" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "heal_reports_report_id_unique" UNIQUE("report_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_heal_reports_created" ON "heal_reports" USING btree ("created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"blocker_id" integer NOT NULL,
	"blocked_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_blocks_pair" ON "user_blocks" USING btree ("blocker_id","blocked_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_blocks_blocker" ON "user_blocks" USING btree ("blocker_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_blocks_blocked" ON "user_blocks" USING btree ("blocked_id");
--> statement-breakpoint

-- Keep dms.is_pinned in sync if an older dms table lacked it
ALTER TABLE "dms" ADD COLUMN IF NOT EXISTS "is_pinned" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "dms" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dms_expires_at" ON "dms" USING btree ("expires_at");
