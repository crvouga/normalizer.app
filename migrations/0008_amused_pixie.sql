CREATE TABLE "normalization_session_projections" (
	"normalization_session_id" text PRIMARY KEY NOT NULL,
	"projection" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
