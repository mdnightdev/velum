CREATE TABLE "support_admin_nominations" (
	"id" serial PRIMARY KEY NOT NULL,
	"nominated_user_id" integer NOT NULL,
	"nominated_by" integer NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"admin_account_id" integer,
	"credentials" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(32) NOT NULL,
	"password_hash" text NOT NULL,
	"salt" text NOT NULL,
	"passcode_hash" text,
	"panic_phrase_hash" text,
	"recovery_key_hash" text,
	"login_recovery_key_hash" text,
	"recovery_key" text,
	"recovery_key_delivered" boolean DEFAULT false NOT NULL,
	"duress_active" boolean DEFAULT false NOT NULL,
	"is_compromised" boolean DEFAULT false NOT NULL,
	"compromise_ticket_id" varchar(32),
	"temp_restore_code" varchar(64),
	"role" varchar(32) DEFAULT 'USER' NOT NULL,
	"display_name" varchar(64),
	"avatar_url" text,
	"bio" text,
	"location" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" varchar(32) NOT NULL,
	"wallet_id" integer NOT NULL,
	"type" varchar(16) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"status" varchar(16) DEFAULT 'COMPLETED' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"balance" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(8) DEFAULT 'USD' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escrows" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"buyer_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"status" varchar(16) DEFAULT 'HELD' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"title" varchar(128) NOT NULL,
	"description" text NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"category" varchar(64) NOT NULL,
	"stock" integer DEFAULT 1 NOT NULL,
	"digital_delivery" boolean DEFAULT false NOT NULL,
	"digital_payload" text,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lounge_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"lounge_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lounges" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64),
	"name" varchar(64) NOT NULL,
	"description" text,
	"owner_id" integer,
	"parent_lounge_id" integer,
	"is_official" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"invite_code" varchar(64),
	"access_level" varchar(32) DEFAULT 'ALL' NOT NULL,
	"type" varchar(32) DEFAULT 'user_created' NOT NULL,
	"avatar_url" varchar(512),
	"last_message_at" timestamp,
	"last_message_text" text,
	"last_message_sender_id" integer,
	"current_sequence_id" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lounges_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_message_user_emoji" UNIQUE("message_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"lounge_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"content" text NOT NULL,
	"client_msg_id" varchar(128),
	"sequence_id" integer DEFAULT 0 NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"delivered_to" text DEFAULT '',
	"read_by" text DEFAULT '',
	"is_edited" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"reply_to" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_unread_counts" (
	"user_id" integer NOT NULL,
	"lounge_id" integer NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_unread_counts_user_id_lounge_id_pk" PRIMARY KEY("user_id","lounge_id")
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"aggregate_id" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"issue_type" varchar(32) DEFAULT 'recovery_request' NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"credibility_score" integer DEFAULT 95 NOT NULL,
	"tracking_id" varchar(64),
	"provided_recovery_key" varchar(32),
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"log_id" varchar(64) NOT NULL,
	"admin_id" integer NOT NULL,
	"admin_name" varchar(64) NOT NULL,
	"action" varchar(128) NOT NULL,
	"target_id" varchar(128),
	"reason" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_log_id_unique" UNIQUE("log_id")
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"card_token" varchar(32) NOT NULL,
	"card_type" varchar(16) DEFAULT 'CREDIT' NOT NULL,
	"limit_cents" integer DEFAULT 500000 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cards_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "cards_card_token_unique" UNIQUE("card_token")
);
--> statement-breakpoint
CREATE TABLE "reserves" (
	"id" serial PRIMARY KEY NOT NULL,
	"reserve_type" varchar(32) NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reserves_reserve_type_unique" UNIQUE("reserve_type")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" varchar(64) NOT NULL,
	"device_fingerprint" varchar(64) NOT NULL,
	"user_agent" text,
	"platform" varchar(32),
	"screen_resolution" varchar(32),
	"timezone" varchar(64),
	"language" varchar(16),
	"hardware_concurrency" integer,
	"device_memory" integer,
	"webgl_vendor" varchar(128),
	"webgl_renderer" varchar(128),
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "ip_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"device_id" varchar(64),
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"device_id" varchar(64) NOT NULL,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"base_currency" varchar(8) NOT NULL,
	"quote_currency" varchar(8) NOT NULL,
	"rate" numeric(18, 6) NOT NULL,
	"effective_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"friend_id" integer NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_prekeys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"identity_key" text NOT NULL,
	"signed_prekey" text NOT NULL,
	"signed_prekey_signature" text NOT NULL,
	"one_time_prekeys" text DEFAULT '[]' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_prekeys_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_read_cursors" (
	"user_id" integer NOT NULL,
	"lounge_id" integer NOT NULL,
	"last_read_msg_id" integer,
	"last_read_seq" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_read_cursors_user_id_lounge_id_pk" PRIMARY KEY("user_id","lounge_id")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "lounge_mute_settings" (
	"user_id" integer NOT NULL,
	"lounge_id" integer NOT NULL,
	"mute_rule" varchar(32) DEFAULT 'off' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lounge_mute_settings_user_id_lounge_id_pk" PRIMARY KEY("user_id","lounge_id")
);
--> statement-breakpoint
ALTER TABLE "support_admin_nominations" ADD CONSTRAINT "support_admin_nominations_nominated_user_id_users_id_fk" FOREIGN KEY ("nominated_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_admin_nominations" ADD CONSTRAINT "support_admin_nominations_nominated_by_users_id_fk" FOREIGN KEY ("nominated_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lounge_members" ADD CONSTRAINT "lounge_members_lounge_id_lounges_id_fk" FOREIGN KEY ("lounge_id") REFERENCES "public"."lounges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lounge_members" ADD CONSTRAINT "lounge_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lounges" ADD CONSTRAINT "lounges_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lounges" ADD CONSTRAINT "lounges_parent_lounge_id_lounges_id_fk" FOREIGN KEY ("parent_lounge_id") REFERENCES "public"."lounges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lounges" ADD CONSTRAINT "lounges_last_message_sender_id_users_id_fk" FOREIGN KEY ("last_message_sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_lounge_id_lounges_id_fk" FOREIGN KEY ("lounge_id") REFERENCES "public"."lounges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_unread_counts" ADD CONSTRAINT "user_unread_counts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_unread_counts" ADD CONSTRAINT "user_unread_counts_lounge_id_lounges_id_fk" FOREIGN KEY ("lounge_id") REFERENCES "public"."lounges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ip_addresses" ADD CONSTRAINT "ip_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_prekeys" ADD CONSTRAINT "user_prekeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_read_cursors" ADD CONSTRAINT "user_read_cursors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_read_cursors" ADD CONSTRAINT "user_read_cursors_lounge_id_lounges_id_fk" FOREIGN KEY ("lounge_id") REFERENCES "public"."lounges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_read_cursors" ADD CONSTRAINT "user_read_cursors_last_read_msg_id_messages_id_fk" FOREIGN KEY ("last_read_msg_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lounge_mute_settings" ADD CONSTRAINT "lounge_mute_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lounge_mute_settings" ADD CONSTRAINT "lounge_mute_settings_lounge_id_lounges_id_fk" FOREIGN KEY ("lounge_id") REFERENCES "public"."lounges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_nominations_user" ON "support_admin_nominations" USING btree ("nominated_user_id");--> statement-breakpoint
CREATE INDEX "idx_nominations_status" ON "support_admin_nominations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_tx_wallet_id" ON "transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "idx_tx_created_at" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_wallets_user_id" ON "wallets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_escrows_listing_id" ON "escrows" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_escrows_buyer_id" ON "escrows" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "idx_escrows_seller_id" ON "escrows" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_listings_seller_id" ON "listings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_listings_category" ON "listings" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_lounge_members_lounge_user" ON "lounge_members" USING btree ("lounge_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_lounges_owner_id" ON "lounges" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_lounges_parent_lounge_id" ON "lounges" USING btree ("parent_lounge_id");--> statement-breakpoint
CREATE INDEX "idx_lounges_slug" ON "lounges" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_lounges_last_message_at" ON "lounges" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "idx_message_reactions_message" ON "message_reactions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_messages_lounge_id" ON "messages" USING btree ("lounge_id");--> statement-breakpoint
CREATE INDEX "idx_messages_sender_id" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_lounge_created" ON "messages" USING btree ("lounge_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_client_msg_id" ON "messages" USING btree ("sender_id","client_msg_id");--> statement-breakpoint
CREATE INDEX "idx_messages_lounge_sequence" ON "messages" USING btree ("lounge_id","sequence_id");--> statement-breakpoint
CREATE INDEX "idx_user_unread_counts_user" ON "user_unread_counts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_unread_counts_lounge" ON "user_unread_counts" USING btree ("lounge_id");--> statement-breakpoint
CREATE INDEX "idx_cards_user_id" ON "cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cards_token" ON "cards" USING btree ("card_token");--> statement-breakpoint
CREATE INDEX "idx_devices_device_id" ON "devices" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_devices_fingerprint" ON "devices" USING btree ("device_fingerprint");--> statement-breakpoint
CREATE INDEX "idx_ip_addresses_user_id" ON "ip_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ip_addresses_ip" ON "ip_addresses" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "idx_user_devices_user_id" ON "user_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_devices_device_id" ON "user_devices" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_exchange_rates_pair" ON "exchange_rates" USING btree ("base_currency","quote_currency");--> statement-breakpoint
CREATE INDEX "idx_relationships_user_friend" ON "relationships" USING btree ("user_id","friend_id");--> statement-breakpoint
CREATE INDEX "idx_relationships_status" ON "relationships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_prekeys_user_id" ON "user_prekeys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_read_cursors_user" ON "user_read_cursors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_read_cursors_lounge" ON "user_read_cursors" USING btree ("lounge_id");--> statement-breakpoint
CREATE INDEX "idx_push_subscriptions_user" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_lounge_mutes_user" ON "lounge_mute_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_lounge_mutes_lounge" ON "lounge_mute_settings" USING btree ("lounge_id");