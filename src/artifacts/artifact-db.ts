import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Logger } from '../lib/logger';
import type { ObjectStore } from '../lib/object-store/object-store';
import type { Db, Tx } from '../shared/db';
import { UserId } from '../users/user-id';
import * as schema from '../db/schema';
import { Artifact } from './artifact';
import { ArtifactId } from './artifact-id';
import { populateArtifactUrls } from './artifact-urls-populate';

/**
 * Database operations for artifacts
 */
export class ArtifactDb {
  constructor(
    private readonly tx: Tx | Db,
    private readonly logger?: Logger,
  ) {}

  /**
   * Get a single artifact by ID (excluding deleted artifacts)
   */
  async getById(artifactId: ArtifactId): Promise<Artifact | null> {
    const row = await this.tx
      .select()
      .from(schema.artifacts)
      .where(and(eq(schema.artifacts.id, artifactId), isNull(schema.artifacts.deleted)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!row) {
      return null;
    }

    const parsed = Artifact.schema.safeParse(row);
    if (!parsed.success) {
      this.logger?.warn('Failed to parse artifact', {
        artifactId,
        error: parsed.error,
      });
      return null;
    }

    return parsed.data;
  }

  /**
   * Get multiple artifacts by IDs (excluding deleted artifacts)
   */
  async getByIds(artifactIdsInput: Iterable<ArtifactId>): Promise<Artifact[]> {
    const artifactIds = Array.from(artifactIdsInput);

    if (artifactIds.length === 0) {
      return [];
    }

    const rows = await this.tx
      .select()
      .from(schema.artifacts)
      .where(and(inArray(schema.artifacts.id, artifactIds), isNull(schema.artifacts.deleted)));

    return rows.flatMap((row) => {
      const parsed = Artifact.schema.safeParse(row);
      if (parsed.success) {
        return [parsed.data];
      }
      this.logger?.warn('Failed to parse artifact', {
        artifactId: row.id,
        error: parsed.error,
      });
      return [];
    });
  }

  /**
   * List artifacts by user (uploaded status, not deleted)
   */
  async listByUser(userId: UserId): Promise<Artifact[]> {
    const rows = await this.tx
      .select()
      .from(schema.artifacts)
      .where(
        and(
          eq(schema.artifacts.status, 'uploaded'),
          eq(schema.artifacts.uploaded_by_user_id, userId),
          isNull(schema.artifacts.deleted),
        ),
      )
      .orderBy(schema.artifacts.created_at);

    return rows.flatMap((row) => {
      const parsed = Artifact.schema.safeParse(row);
      if (parsed.success) {
        return [parsed.data];
      }
      this.logger?.warn('Failed to parse artifact', {
        artifactId: row.id,
        error: parsed.error,
      });
      return [];
    });
  }

  /**
   * Create a new artifact
   */
  async create(artifactData: {
    id: ArtifactId;
    filename: string;
    content_type: string;
    size: number;
    file_type: string;
    status: 'pending' | 'uploaded';
    uploaded_by: 'system' | 'user';
    object_bucket: string;
    object_key: string;
    name?: string | null;
    uploaded_by_user_id: UserId;
    created_at?: Date;
    updated_at?: Date;
  }): Promise<void> {
    await this.tx.insert(schema.artifacts).values({
      id: artifactData.id,
      filename: artifactData.filename,
      content_type: artifactData.content_type,
      size: artifactData.size,
      file_type: artifactData.file_type,
      status: artifactData.status,
      object_bucket: artifactData.object_bucket,
      object_key: artifactData.object_key,
      name: artifactData.name ?? null,
      uploaded_by: artifactData.uploaded_by,
      uploaded_by_user_id: artifactData.uploaded_by_user_id,
      created_at: artifactData.created_at ?? new Date(),
      updated_at: artifactData.updated_at ?? new Date(),
    });
  }

  /**
   * Update artifact status and size
   */
  async updateStatus(
    artifactId: ArtifactId,
    status: 'pending' | 'uploaded',
    size: number,
  ): Promise<void> {
    await this.tx
      .update(schema.artifacts)
      .set({
        status,
        size,
        updated_at: new Date(),
      })
      .where(eq(schema.artifacts.id, artifactId));
  }

  /**
   * Update artifact URLs
   */
  async updateUrls(artifact: Artifact): Promise<void> {
    await this.tx
      .update(schema.artifacts)
      .set({
        upload_url: artifact.upload_url,
        upload_url_expires_at: artifact.upload_url_expires_at,
        download_url: artifact.download_url,
        download_url_expires_at: artifact.download_url_expires_at,
        updated_at: new Date(),
      })
      .where(and(eq(schema.artifacts.id, String(artifact.id)), isNull(schema.artifacts.deleted)));
  }

  /**
   * Generic update method for artifacts
   * Updates specified fields and returns the updated artifact
   */
  async update(
    artifactId: ArtifactId,
    updates: {
      filename?: string | null;
      name?: string | null;
      description?: string | null;
      tags?: string[] | null;
      sha256?: string | null;
      upload_ip?: string | null;
      s3_key?: string | null;
      s3_bucket?: string | null;
    },
  ): Promise<Artifact> {
    const updateData: Partial<{
      filename: string;
      name: string | null;
      description: string | null;
      tags: string[] | null;
      sha256: string | null;
      upload_ip: string | null;
      s3_key: string;
      s3_bucket: string;
      updated_at: Date;
    }> = {
      updated_at: new Date(),
    };

    // Only include fields that are explicitly provided
    if (updates.filename !== undefined && updates.filename !== null) {
      updateData.filename = updates.filename;
    }
    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }
    if (updates.tags !== undefined) {
      updateData.tags = updates.tags;
    }
    if (updates.sha256 !== undefined) {
      updateData.sha256 = updates.sha256;
    }
    if (updates.upload_ip !== undefined) {
      updateData.upload_ip = updates.upload_ip;
    }
    if (updates.s3_key !== undefined && updates.s3_key !== null) {
      updateData.s3_key = updates.s3_key;
    }
    if (updates.s3_bucket !== undefined && updates.s3_bucket !== null) {
      updateData.s3_bucket = updates.s3_bucket;
    }

    await this.tx
      .update(schema.artifacts)
      .set(updateData)
      .where(eq(schema.artifacts.id, artifactId));

    const updated = await this.getById(artifactId);
    if (!updated) {
      throw new Error('Artifact not found after update');
    }

    return updated;
  }

  /**
   * Clone an artifact with a new ID
   * Creates a copy of the artifact with a new ID and updated timestamps
   */
  async clone(artifact: Artifact, newId: ArtifactId): Promise<void> {
    const now = new Date();
    await this.tx.insert(schema.artifacts).values({
      id: newId,
      filename: artifact.filename,
      content_type: artifact.content_type,
      size: artifact.size,
      file_type: artifact.file_type,
      status: artifact.status,
      object_bucket: artifact.object_bucket,
      object_key: artifact.object_key,
      name: artifact.name ?? null,
      uploaded_by: artifact.uploaded_by ?? 'user',
      uploaded_by_user_id: artifact.uploaded_by_user_id ?? null,
      upload_ip: artifact.upload_ip ?? null,
      sha256: artifact.sha256 ?? null,
      download_url: artifact.download_url ?? null,
      download_url_expires_at: artifact.download_url_expires_at ?? null,
      upload_url: artifact.upload_url ?? null,
      upload_url_expires_at: artifact.upload_url_expires_at ?? null,
      tags: artifact.tags ?? null,
      description: artifact.description ?? null,
      deleted: artifact.deleted ?? null,
      created_at: now,
      updated_at: now,
    });
  }

  /**
   * Refreshes artifact URLs by populating them with fresh presigned URLs if needed,
   * and persists the updated URLs to the database.
   */
  async refresh(params: { artifacts: Artifact[]; objectStore: ObjectStore }): Promise<Artifact[]> {
    const { artifacts, objectStore } = params;

    if (artifacts.length === 0) {
      return artifacts;
    }

    // Populate URLs and get update metadata
    const { artifacts: artifactsWithUrls, updated } = await populateArtifactUrls({
      artifacts: artifacts,
      objectStore,
    });

    // Update database for artifacts with refreshed URLs
    if (updated.size > 0) {
      this.logger?.debug('Updating artifact URLs', {
        count: updated.size,
        artifactIds: Array.from(updated),
      });

      // Update all artifacts with refreshed URLs in parallel
      await Promise.all(
        artifactsWithUrls
          .filter((artifact) => updated.has(String(artifact.id)))
          .map((artifact) => this.updateUrls(artifact)),
      );
    }

    return artifactsWithUrls;
  }

  /**
   * Fetch artifacts by IDs and refresh their URLs.
   */
  async getRefreshed(
    artifactIdsInput: Iterable<ArtifactId>,
    objectStore: ObjectStore,
  ): Promise<Artifact[]> {
    const artifacts = await this.getByIds(artifactIdsInput);
    if (artifacts.length === 0) {
      return [];
    }
    return this.refresh({ artifacts, objectStore });
  }
}

export function createArtifactDb(params: { tx: Tx | Db; logger?: Logger }): ArtifactDb {
  return new ArtifactDb(params.tx, params.logger);
}
