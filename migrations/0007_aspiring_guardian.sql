CREATE TABLE IF NOT EXISTS "normalization_session_events" (
	"id" text PRIMARY KEY NOT NULL,
	"normalization_session_id" text NOT NULL,
	"event" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "normalization_session_events_session_id_idx" ON "normalization_session_events" USING btree ("normalization_session_id");
