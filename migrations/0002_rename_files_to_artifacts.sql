-- Rename the enum type from file_status to artifact_status
ALTER TYPE "file_status" RENAME TO "artifact_status";--> statement-breakpoint

-- Rename the table from files to artifacts
ALTER TABLE "files" RENAME TO "artifacts";

