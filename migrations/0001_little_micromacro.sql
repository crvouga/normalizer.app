CREATE TYPE "public"."file_status" AS ENUM('pending', 'uploaded');--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "status" SET DATA TYPE file_status;