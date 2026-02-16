CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_token" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"token_prefix" text NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" text DEFAULT '["icons:read"]' NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_token_token_prefix_unique" UNIQUE("token_prefix"),
	CONSTRAINT "api_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"prefix" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"total" integer NOT NULL,
	"author" text,
	"license" text,
	"category" text,
	"palette" boolean,
	"height" integer,
	"version" text,
	"samples" text
);
--> statement-breakpoint
CREATE TABLE "daily_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"search_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icons" (
	"id" serial PRIMARY KEY NOT NULL,
	"prefix" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"body" text NOT NULL,
	"width" integer,
	"height" integer,
	"category" text,
	"tags" text,
	"search_text" text,
	"embedding" vector(256)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"search_limit" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_token_userId_idx" ON "api_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_token_revokedAt_idx" ON "api_token" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "collections_category_idx" ON "collections" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_usage_user_date_idx" ON "daily_usage" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "icons_full_name_idx" ON "icons" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "icons_prefix_name_idx" ON "icons" USING btree ("prefix","name");--> statement-breakpoint
CREATE INDEX "icons_category_idx" ON "icons" USING btree ("category");--> statement-breakpoint
CREATE INDEX "icons_category_prefix_name_idx" ON "icons" USING btree ("category","prefix","name");--> statement-breakpoint
CREATE INDEX "icons_prefix_category_idx" ON "icons" USING btree ("prefix","category");--> statement-breakpoint
CREATE INDEX "icons_embedding_idx" ON "icons" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");