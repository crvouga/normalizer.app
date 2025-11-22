CREATE TYPE "public"."artifact_uploaded_by" AS ENUM('system', 'user');--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "uploaded_by" "artifact_uploaded_by";
UPDATE "artifacts" SET "uploaded_by" = 'user' WHERE "uploaded_by" IS NULL;
ALTER TABLE "artifacts" ALTER COLUMN "uploaded_by" SET NOT NULL;