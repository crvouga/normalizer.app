ALTER TABLE "normalization_session_events" RENAME TO "workspace_events";--> statement-breakpoint
ALTER TABLE "normalization_session_projections" RENAME TO "workspace_projections";--> statement-breakpoint
ALTER TABLE "workspace_events" RENAME COLUMN "normalization_session_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "workspace_projections" RENAME COLUMN "normalization_session_id" TO "workspace_id";--> statement-breakpoint
DROP INDEX "normalization_session_events_session_id_idx";--> statement-breakpoint
CREATE INDEX "workspace_events_workspace_id_idx" ON "workspace_events" USING btree ("workspace_id");