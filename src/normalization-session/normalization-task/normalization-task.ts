import { enumerate } from '~/src/lib/array/enumerate';
import { createLLMOpenAI, DEFAULT_MODEL } from '~/src/lib/llm/llm-open-ai';
import { isErr } from '~/src/lib/result';
import type { TaskHandler } from '~/src/shared/graphile-worker';
import { Artifact as ArtifactFactory } from '../../artifacts/artifact';
import { ArtifactDb } from '../../artifacts/artifact-db';
import { ArtifactId } from '../../artifacts/artifact-id';
import { refreshArtifactData } from '../../artifacts/artifact-refresh';
import * as schema from '../../db/schema';
import type { Logger } from '../../lib/logger';
import { createNormalizer } from '../../lib/normalizer/normalizer';
import type { Db, Tx } from '../../shared/db';
import { createObjectStore } from '../../shared/s3';
import { getS3Config } from '../../shared/s3-config';
import type { UserId } from '../../users/user-id';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionEventId } from '../normalization-session-event/normalization-session-event-id';
import { NormalizationSessionId } from '../normalization-session-id';
import type { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
import { NormalizationSessionProjectionDb } from '../normalization-session-projection/normalization-session-projection-db';
import type { NormalizationSessionProjectionEntry } from '../normalization-session-projection/normalization-session-projection-entry';
import { toNormalizedFileName } from './normalized-file-name';

/**
 * Normalization task handler
 * Processes a normalization job for a given session
 */
export const normalizationTask: TaskHandler<'normalization'> = async (ctx, payload) => {
  const { sessionId } = payload;
  const { db } = ctx;
  const logger = ctx.logger.child(normalizationTask.name);

  logger.info('Starting normalization task', { sessionId });

  try {
    const { startedByUserId, inProgressEntry, projection } = await loadNormalizationData({
      db,
      logger,
      sessionId,
    });

    if (!inProgressEntry) {
      logger.info('No in-progress normalization entry found, skipping task', {
        sessionId,
      });
      return;
    }

    logger.info('Processing normalization entry', {
      sessionId,
      normalizationRunId: inProgressEntry.normalizationRunId,
      inputArtifactIds: inProgressEntry.inputArtifactIds,
    });

    await db.transaction(async (tx: Tx) => {
      const outputArtifactIds = await performNormalization({
        tx,
        logger,
        sessionId,
        inProgressEntry,
        projection,
        startedByUserId,
      });

      await recordNormalizationResult({
        tx,
        logger,
        sessionId,
        startedByUserId,
        inProgressEntry,
        outputArtifactIds,
      });
    });
  } catch (error) {
    logger.error('Normalization task failed', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * Loads the normalization session data needed to perform normalization
 */
async function loadNormalizationData({
  db,
  logger,
  sessionId,
}: {
  db: Db;
  logger: Logger;
  sessionId: NormalizationSessionId;
}): Promise<{
  startedByUserId: UserId;
  projection: NormalizationSessionProjection;
  inProgressEntry: NormalizationSessionProjectionEntry | null;
}> {
  const projectionDb = new NormalizationSessionProjectionDb(db, logger);

  const startedByUserId = await projectionDb.getOwner(sessionId);

  if (!startedByUserId) {
    logger.error('Normalization session not found', { sessionId });
    throw new Error(`Normalization session not found: ${sessionId}`);
  }

  const projection = await projectionDb.load(sessionId, startedByUserId);

  const inProgressEntry =
    projection.entries.find(
      (entry) => entry.type === 'normalization' && entry.status === 'in_progress',
    ) ?? null;

  return {
    startedByUserId,
    projection,
    inProgressEntry,
  };
}

/**
 * Performs the normalization work: normalizes inputs against targets and creates output artifacts
 */
async function performNormalization({
  tx,
  logger,
  sessionId,
  inProgressEntry,
  projection,
  startedByUserId,
}: {
  tx: Tx;
  logger: Logger;
  sessionId: NormalizationSessionId;
  inProgressEntry: NormalizationSessionProjectionEntry;
  projection: NormalizationSessionProjection;
  startedByUserId: UserId;
}): Promise<ArtifactId[]> {
  const objectStore = await createObjectStore({ logger });
  const llm = createLLMOpenAI({ logger, model: DEFAULT_MODEL });

  const normalizer = createNormalizer({
    objectStore,
    logger,
    llm,
  });

  const artifactDb = new ArtifactDb(tx, logger);
  const inputArtifacts = await artifactDb.getByIds(inProgressEntry.inputArtifactIds);
  const targetArtifacts = await artifactDb.getByIds(projection.targetArtifactIds);
  const { s3Bucket } = getS3Config();
  const normalizationRunId = inProgressEntry.normalizationRunId;

  const inputs = inputArtifacts.map((artifact) => ({
    key: artifact.object_key,
    bucket: artifact.object_bucket,
  }));

  const targets = targetArtifacts.map((artifact) => ({
    key: artifact.object_key,
    bucket: artifact.object_bucket,
  }));

  const normalizeResult = await normalizer.normalize({
    inputs,
    targets,
    outputObjectBucket: s3Bucket,
    outputObjectKeyPrefix: `normalizer-output/${normalizationRunId}/`,
  });

  if (isErr(normalizeResult)) {
    logger.error('Normalization failed', {
      sessionId,
      normalizationRunId,
      error: normalizeResult.error,
    });
    throw new Error(`Normalization failed: ${normalizeResult.error}`);
  }

  const { outputs } = normalizeResult.value;

  const outputArtifactIds: ArtifactId[] = [];

  const maybeTemplateArtifact = inputArtifacts[0];

  if (!maybeTemplateArtifact) {
    throw new Error('No input artifacts available to use as template');
  }

  const baseName = maybeTemplateArtifact.name || maybeTemplateArtifact.filename;
  const normalizedName = toNormalizedFileName(baseName);

  for (const [index, output] of enumerate(outputs)) {
    const outputArtifactId = ArtifactId.generate();

    outputArtifactIds.push(outputArtifactId);

    const artifact = ArtifactFactory.create({
      id: outputArtifactId,
      filename: maybeTemplateArtifact.filename,
      content_type: maybeTemplateArtifact.content_type,
      uploaded_by: 'system',
      name: outputs.length > 1 ? `${normalizedName}-${index}` : normalizedName,
    });

    await artifactDb.create({
      id: artifact.id,
      filename: artifact.filename,
      content_type: artifact.content_type,
      size: 0,
      file_type: artifact.file_type,
      status: 'uploaded',
      uploaded_by: artifact.uploaded_by,
      object_bucket: output.bucket,
      object_key: output.key,
      name: artifact.name ?? null,
      uploaded_by_user_id: startedByUserId,
    });
  }

  // Refresh derived data (URLs, sizes, etc.) for output artifacts
  const outputArtifacts = await artifactDb.getByIds(outputArtifactIds);
  const { artifacts: artifactsWithUrls } = await refreshArtifactData({
    artifacts: outputArtifacts,
    objectStore,
  });

  // Update artifacts with populated URLs and sizes
  for (const artifact of artifactsWithUrls) {
    await artifactDb.updateUrls(artifact);

    // Update size if it was populated (size changed from 0)
    const originalArtifact = outputArtifacts.find((a) => a.id === artifact.id);
    if (originalArtifact && originalArtifact.size === 0 && artifact.size > 0) {
      await artifactDb.updateStatus(artifact.id, artifact.status, artifact.size);
    }
  }

  logger.debug('Created normalized artifacts', {
    sessionId,
    normalizationRunId,
    inputCount: inputArtifacts.length,
    targetCount: targetArtifacts.length,
    outputCount: outputArtifactIds.length,
  });

  return outputArtifactIds;
}

/**
 * Records the normalization result: creates completion event and refreshes projection
 */
async function recordNormalizationResult({
  tx,
  logger,
  sessionId,
  startedByUserId,
  inProgressEntry,
  outputArtifactIds,
}: {
  tx: Tx;
  logger: Logger;
  sessionId: NormalizationSessionId;
  startedByUserId: UserId;
  inProgressEntry: NormalizationSessionProjectionEntry;
  outputArtifactIds: ArtifactId[];
}): Promise<void> {
  const now = new Date();

  const eventId = NormalizationSessionEventId.generate();
  const completedEvent: NormalizationSessionEventEntity = {
    id: eventId,
    normalization_session_id: sessionId,
    event: {
      type: 'system-normalization-completed',
      sessionId,
      normalizationRunId: inProgressEntry.normalizationRunId,
      outputArtifactIds,
      completedAt: now,
    },
    created_at: now,
  };

  await tx.insert(schema.normalizationSessionEvents).values(completedEvent);

  const projectionDb = new NormalizationSessionProjectionDb(tx, logger);
  await projectionDb.refresh(sessionId, startedByUserId);

  logger.info('Normalization task completed', {
    sessionId,
    normalizationRunId: inProgressEntry.normalizationRunId,
    outputArtifactIds,
  });
}
