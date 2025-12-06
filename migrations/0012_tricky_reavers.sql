ALTER TABLE "artifacts" RENAME COLUMN "s3_bucket" TO "object_bucket";--> statement-breakpoint
ALTER TABLE "artifacts" RENAME COLUMN "s3_key" TO "object_key";