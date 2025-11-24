import { enumerate } from '~/src/lib/array/enumerate';
import { createLLMOpenAI } from '~/src/lib/llm/llm-open-ai';
import { isOk } from '~/src/lib/result';
import { ArtifactDb } from '../../artifacts/artifact-db';
import { ArtifactId } from '../../artifacts/artifact-id';
import * as schema from '../../db/schema';
import type { TaskHandler } from '../../lib/graphile-worker-lib';
import type { Logger } from '../../lib/logger';
import { createNormalizer } from '../../lib/normalizer/normalizer';
import type { NormalizationJobPayload } from '../../shared/graphile-worker';
import { createObjectStore } from '../../shared/s3';
import { getS3Config } from '../../shared/s3-config';
import type { Db, Tx } from '../../shared/db';
import { createDb } from '../../shared/db';
import type { UserId } from '../../users/user-id';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionEventId } from '../normalization-session-event/normalization-session-event-id';
import { NormalizationSessionId } from '../normalization-session-id';
import type { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
import { NormalizationSessionProjectionDb } from '../normalization-session-projection/normalization-session-projection-db';
import type { NormalizationSessionProjectionEntry } from '../normalization-session-projection/normalization-session-projection-entry';
import { toNormalizedFileName } from './normalized-file-name';
import type { Artifact } from '~/src/artifacts/artifact-type';

/**
 * Normalization task handler
 * Processes a normalization job for a given session
 */
export const normalizationTask: TaskHandler<NormalizationJobPayload> = async (payload, ctx) => {
  const { sessionId } = payload;
  const { logger } = ctx;

  logger.info('Starting normalization task', { sessionId });

  // Create database connection
  const db = await createDb({ logger });

  try {
    // Load initial data
    const { startedByUserId, inProgressEntry, projection } = await loadNormalizationData({
      db,
      logger,
      sessionId,
    });

    logger.info('Processing normalization entry', {
      sessionId,
      normalizationRunId: inProgressEntry.normalizationRunId,
      inputArtifactIds: inProgressEntry.inputArtifactIds,
    });

    // Perform normalization in a single transaction
    await db.transaction(async (tx: Tx) => {
      // Perform the normalization work
      const outputArtifactIds = await performNormalization({
        tx,
        logger,
        sessionId,
        inProgressEntry,
        projection,
      });

      // Record the result
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
  inProgressEntry: NormalizationSessionProjectionEntry;
}> {
  const projectionDb = new NormalizationSessionProjectionDb(db, logger);

  // Get the session owner
  const startedByUserId = await projectionDb.getOwner(sessionId);

  if (!startedByUserId) {
    logger.error('Normalization session not found', { sessionId });
    throw new Error(`Normalization session not found: ${sessionId}`);
  }

  const projection = await projectionDb.load(sessionId, startedByUserId);

  // Find the in-progress normalization entry
  const inProgressEntry = projection.entries.find(
    (entry) => entry.type === 'normalization' && entry.status === 'in_progress',
  );

  if (!inProgressEntry) {
    logger.warn('No in-progress normalization entry found', {
      sessionId,
      entryCount: projection.entries.length,
    });
    throw new Error('No in-progress normalization entry found');
  }

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
}: {
  tx: Tx;
  logger: Logger;
  sessionId: NormalizationSessionId;
  inProgressEntry: NormalizationSessionProjectionEntry;
  projection: NormalizationSessionProjection;
}): Promise<ArtifactId[]> {
  // Create object store and normalizer
  const objectStore = await createObjectStore({ logger });
  const llm = createLLMOpenAI({ logger });
  const normalizer = createNormalizer({ objectStore, logger, llm });

  // Load input artifacts
  const artifactDb = new ArtifactDb(tx, logger);
  const inputArtifacts = await artifactDb.getByIds(inProgressEntry.inputArtifactIds);

  if (inputArtifacts.length !== inProgressEntry.inputArtifactIds.length) {
    logger.warn('Some input artifacts not found', {
      sessionId,
      expected: inProgressEntry.inputArtifactIds.length,
      found: inputArtifacts.length,
    });
  }

  // Load target artifacts (if any)
  const targetArtifacts = await artifactDb.getByIds(projection.targetArtifactIds);

  if (
    projection.targetArtifactIds.length > 0 &&
    targetArtifacts.length !== projection.targetArtifactIds.length
  ) {
    logger.warn('Some target artifacts not found', {
      sessionId,
      expected: projection.targetArtifactIds.length,
      found: targetArtifacts.length,
    });
  }

  // Get S3 bucket configuration
  const { s3Bucket } = getS3Config();
  const normalizationRunId = inProgressEntry.normalizationRunId;

  // Prepare inputs and targets for normalization
  const inputs = inputArtifacts.map((artifact) => ({
    objectKey: artifact.object_key,
    objectBucket: artifact.object_bucket,
  }));

  const targets = targetArtifacts.map((artifact) => ({
    objectKey: artifact.object_key,
    objectBucket: artifact.object_bucket,
  }));

  // Call normalize with all inputs and targets
  const normalizeResult = await normalizer.normalize({
    inputs,
    targets,
    outputObjectBucket: s3Bucket,
    outputObjectKeyPrefix: `normalizer-output/${normalizationRunId}/`,
  });

  if (!isOk(normalizeResult)) {
    logger.error('Normalization failed', {
      sessionId,
      normalizationRunId,
      error: normalizeResult.error,
    });
    throw new Error(`Normalization failed: ${normalizeResult.error}`);
  }

  const { outputs } = normalizeResult.value;

  // Create artifacts for each output
  const outputArtifactIds: ArtifactId[] = [];

  for (const [index, output] of enumerate(outputs)) {
    const outputArtifactId = ArtifactId.generate();

    outputArtifactIds.push(outputArtifactId);

    // Use the first input artifact as a template for cloning
    const maybeTemplateArtifact = inputArtifacts[0];

    if (!maybeTemplateArtifact) {
      throw new Error('No input artifacts available to use as template');
    }

    const templateArtifact: Artifact = {
      ...maybeTemplateArtifact,
      uploaded_by: 'system',
    };

    // Clone the artifact with a new ID
    await artifactDb.clone(templateArtifact, outputArtifactId);

    // Update the artifact with output S3 key/bucket and normalized name
    const baseName = templateArtifact.name || templateArtifact.filename;
    const normalizedName = toNormalizedFileName(baseName);

    await artifactDb.update(outputArtifactId, {
      s3_key: output.objectKey,
      s3_bucket: output.objectBucket,
      name: outputs.length > 1 ? `${normalizedName}-${index}` : normalizedName,
    });
  }

  logger.info('Created normalized artifacts', {
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

  // Create and insert the system-normalization-completed event
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

  // Refresh the projection
  const projectionDb = new NormalizationSessionProjectionDb(tx, logger);
  await projectionDb.refresh(sessionId, startedByUserId);

  logger.info('Normalization task completed', {
    sessionId,
    normalizationRunId: inProgressEntry.normalizationRunId,
    outputArtifactIds,
  });
}
