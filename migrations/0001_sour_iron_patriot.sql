CREATE TABLE "normalizer_app"."normalization_logs" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"normalization_run_id" text NOT NULL,
	"level" text NOT NULL,
	"scope" text NOT NULL,
	"message" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "normalization_logs_workspace_id_idx" ON "normalizer_app"."normalization_logs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "normalization_logs_normalization_run_id_idx" ON "normalizer_app"."normalization_logs" USING btree ("normalization_run_id");