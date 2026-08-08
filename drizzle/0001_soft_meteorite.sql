CREATE TABLE "icon_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"source" text NOT NULL,
	"full_name" text,
	"prefix" text,
	"client" text,
	"client_version" text,
	"query" text,
	"result_count" integer,
	"format" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_token" ADD COLUMN "client_name" text;--> statement-breakpoint
ALTER TABLE "api_token" ADD COLUMN "client_version" text;--> statement-breakpoint
ALTER TABLE "api_token" ADD COLUMN "client_seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "icon_events" ADD CONSTRAINT "icon_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "icon_events_created_at_idx" ON "icon_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "icon_events_type_created_at_idx" ON "icon_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "icon_events_full_name_created_at_idx" ON "icon_events" USING btree ("full_name","created_at");--> statement-breakpoint
CREATE INDEX "icon_events_source_created_at_idx" ON "icon_events" USING btree ("source","created_at");--> statement-breakpoint
CREATE INDEX "icon_events_user_id_idx" ON "icon_events" USING btree ("user_id");