import type { S3Client } from 'bun';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import type { Logger } from '../lib/logger';
import type { Artifact } from './artifact-type';
import { populateArtifactUrls } from './artifact-urls-populate';

/**
 * Refreshes artifact URLs by populating them with fresh presigned URLs if needed,
 * and persists the updated URLs to the database.
 */
export async function refreshArtifactUrls(params: {
  artifacts: Artifact[];
  s3: S3Client;
  s3Endpoint: string;
  db: NodePgDatabase<typeof schema>;
  logger?: Logger;
}): Promise<Artifact[]> {
  const { artifacts, s3, s3Endpoint, db, logger } = params;

  if (artifacts.length === 0) {
    return artifacts;
  }

  // Populate URLs and get update metadata
  const { artifacts: artifactsWithUrls, updated } = await populateArtifactUrls({
    artifacts: artifacts,
    s3,
    s3Endpoint,
  });

  // Update database for artifacts with refreshed URLs
  if (updated.size > 0) {
    logger?.debug('Updating artifact URLs', {
      count: updated.size,
      artifactIds: Array.from(updated),
    });

    // Update all artifacts with refreshed URLs in parallel
    await Promise.all(
      artifactsWithUrls
        .filter((artifact) => updated.has(String(artifact.id)))
        .map((artifact) =>
          db
            .update(schema.artifacts)
            .set({
              upload_url: artifact.upload_url,
              upload_url_expires_at: artifact.upload_url_expires_at,
              download_url: artifact.download_url,
              download_url_expires_at: artifact.download_url_expires_at,
              updated_at: new Date(),
            })
            .where(
              and(eq(schema.artifacts.id, String(artifact.id)), isNull(schema.artifacts.deleted)),
            ),
        ),
    );
  }

  return artifactsWithUrls;
}
