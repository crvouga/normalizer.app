CREATE TYPE "normalizer_app"."artifact_status" AS ENUM('pending', 'uploaded');--> statement-breakpoint
CREATE TYPE "normalizer_app"."artifact_uploaded_by" AS ENUM('system', 'user');--> statement-breakpoint
CREATE TYPE "normalizer_app"."user_type" AS ENUM('anonymous', 'authenticated');--> statement-breakpoint
CREATE TABLE "normalizer_app"."artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"file_type" text NOT NULL,
	"status" "normalizer_app"."artifact_status" NOT NULL,
	"object_bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp,
	"uploaded_by" "normalizer_app"."artifact_uploaded_by" NOT NULL,
	"uploaded_by_user_id" text,
	"upload_ip" text,
	"sha256" text,
	"download_url" text,
	"download_url_expires_at" timestamp,
	"upload_url" text,
	"upload_url_expires_at" timestamp,
	"name" text,
	"tags" jsonb,
	"description" text,
	"deleted" boolean
);
--> statement-breakpoint
CREATE TABLE "normalizer_app"."key_value_store" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalizer_app"."user_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "normalizer_app"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "normalizer_app"."user_type" NOT NULL,
	"name" text,
	"email" text,
	"google_id" text,
	"profile_picture" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "normalizer_app"."workspace_events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"event" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalizer_app"."workspace_projections" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"projection" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "normalizer_app"."user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "normalizer_app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_events_workspace_id_idx" ON "normalizer_app"."workspace_events" USING btree ("workspace_id");