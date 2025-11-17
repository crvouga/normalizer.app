import { ArtifactDb } from '../../artifacts/artifact-db';
import { ArtifactId } from '../../artifacts/artifact-id';
import * as schema from '../../db/schema';
import type { TaskHandler } from '../../lib/graphile-worker-lib';
import type { NormalizationJobPayload } from '../../shared/graphile-worker';
import type { Tx } from '../../shared/sql';
import { createDb } from '../../shared/sql';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionEventId } from '../normalization-session-event/normalization-session-event-id';
import { NormalizationSessionProjectionDb } from '../normalization-session-projection/normalization-session-projection-db';
import { toNormalizedFileName } from './normalized-file-name';

/**
 * Normalization task handler
 * Processes a normalization job for a given session
 */
export const normalizationTask: TaskHandler<NormalizationJobPayload> = async (payload, helpers) => {
  const { sessionId } = payload;
  const { logger } = helpers;

  logger.info('Starting normalization task', { sessionId });

  // Create database connection
  const db = await createDb({ logger });

  try {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Load the current projection
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
      return;
    }

    logger.info('Processing normalization entry', {
      sessionId,
      normalizationRunId: inProgressEntry.normalizationRunId,
      inputArtifactIds: inProgressEntry.inputArtifactIds,
    });

    // Perform normalization in a single transaction
    await db.transaction(async (tx: Tx) => {
      // 1. Load input artifacts
      const artifactDb = new ArtifactDb(tx, logger);
      const inputArtifacts = await artifactDb.getByIds(inProgressEntry.inputArtifactIds);

      if (inputArtifacts.length !== inProgressEntry.inputArtifactIds.length) {
        logger.warn('Some input artifacts not found', {
          sessionId,
          expected: inProgressEntry.inputArtifactIds.length,
          found: inputArtifacts.length,
        });
      }

      // 2. Create clone artifacts (copies of input artifacts with new IDs)
      const outputArtifactIds: ArtifactId[] = [];
      const now = new Date();

      for (const inputArtifact of inputArtifacts) {
        const outputArtifactId = ArtifactId.generate();
        outputArtifactIds.push(outputArtifactId);

        // Clone the artifact with a new ID
        await artifactDb.clone(inputArtifact, outputArtifactId);

        // Append "_NORMALIZED" to the artifact name, with incrementing number if already exists
        const baseName = inputArtifact.name || inputArtifact.filename;
        const normalizedName = toNormalizedFileName(baseName);
        await artifactDb.update(outputArtifactId, {
          name: normalizedName,
        });
      }

      logger.info('Created cloned artifacts', {
        sessionId,
        normalizationRunId: inProgressEntry.normalizationRunId,
        inputCount: inputArtifacts.length,
        outputCount: outputArtifactIds.length,
      });

      // 3. Create and insert the system-normalization-completed event
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

      // 4. Refresh the projection
      const projectionDb = new NormalizationSessionProjectionDb(tx, logger);
      await projectionDb.refresh(sessionId, startedByUserId);

      logger.info('Normalization task completed', {
        sessionId,
        normalizationRunId: inProgressEntry.normalizationRunId,
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
