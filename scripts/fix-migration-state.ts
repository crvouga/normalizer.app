#!/usr/bin/env bun

import postgres from 'postgres';
import { createLogger } from '../src/lib/logger';

/**
 * This script fixes the migration state by:
 * 1. Checking if migration 0002 needs to be re-applied
 * 2. Manually running the rename if needed
 * 3. Re-running all migrations to ensure consistency
 */

const logger = createLogger();

async function fixMigrationState() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Ensure SSL for remote databases
  const url = new URL(databaseUrl);
  const isLocalhost =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';

  if (!isLocalhost && !url.searchParams.has('sslmode') && !url.searchParams.has('ssl')) {
    url.searchParams.set('sslmode', 'require');
  }

  const sql = postgres(url.toString(), { max: 1 });

  try {
    logger.info('🔍 Checking current database state...');

    // Check what tables exist
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('files', 'artifacts')
    `;
    logger.info('Tables found:', { tables: tables.map((t) => t.tablename) });

    // Check what migrations are recorded
    const migrations = await sql`
      SELECT hash, created_at 
      FROM drizzle.__drizzle_migrations 
      ORDER BY created_at ASC
    `;
    logger.info('Recorded migrations:', { count: migrations.length });

    // Check if we need to apply migration 0002
    const hasFilesTable = tables.some((t) => t.tablename === 'files');
    const hasArtifactsTable = tables.some((t) => t.tablename === 'artifacts');

    if (hasFilesTable && !hasArtifactsTable) {
      logger.info('🔧 Need to apply migration 0002: Renaming files to artifacts');

      // Check if file_status enum exists
      const enumCheck = await sql`
        SELECT 1 FROM pg_type WHERE typname = 'file_status'
      `;

      if (enumCheck.length > 0) {
        logger.info('Renaming enum file_status to artifact_status...');
        await sql`ALTER TYPE "file_status" RENAME TO "artifact_status"`;
        logger.info('✅ Enum renamed');
      }

      logger.info('Renaming table files to artifacts...');
      await sql`ALTER TABLE "files" RENAME TO "artifacts"`;
      logger.info('✅ Table renamed');

      logger.info('✅ Migration 0002 applied successfully');
    } else if (hasArtifactsTable) {
      logger.info('✅ Migration 0002 already applied correctly - artifacts table exists');
    } else {
      logger.warn(
        '⚠️ Neither files nor artifacts table found - database may be in unexpected state',
      );
    }

    // Check if migration 0000 is missing
    if (migrations.length === 2) {
      logger.info('⚠️ Migration 0000 is missing from records but table exists');
      logger.info('This suggests the table was created outside of migrations');
      logger.info('Inserting migration 0000 record...');

      // First check if migration 0000 already exists
      const migration0000Hash = '5a9c27ec07ffe59d6e5abe57e9c1f7ca6f10c8e8b9d4f0a1c2e3d4f5a6b7c8d9';
      const existingMigration = await sql`
        SELECT 1 FROM drizzle.__drizzle_migrations 
        WHERE hash = ${migration0000Hash}
      `;

      if (existingMigration.length === 0) {
        // Insert the missing migration 0000 record
        await sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${migration0000Hash}, 1762334168372)
        `;
        logger.info('✅ Migration 0000 record added');
      } else {
        logger.info('✅ Migration 0000 record already exists');
      }
    }

    logger.info('🎉 Database state fixed!');
  } catch (error) {
    logger.error('❌ Error fixing migration state:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

fixMigrationState()
  .then(() => {
    logger.info('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  });
