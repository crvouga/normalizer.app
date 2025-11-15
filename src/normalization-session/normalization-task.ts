import { and, inArray, isNull } from 'drizzle-orm';
import type { TaskHandler } from '../lib/graphile-worker-lib';
import type { NormalizationJobPayload } from '../lib/graphile-worker';
import { createDb } from '../sql';
import { NormalizationSessionProjectionDb } from './normalization-session-projection/normalization-session-projection-db';
import { getNormalizationSessionOwner } from './normalization-session-permissions';
import { ArtifactId } from '../artifacts/artifact-id';
import * as schema from '../db/schema';
import { NormalizationSessionEventId } from './normalization-session-event/normalization-session-event-id';
import { NormalizationSessionEventEntity } from './normalization-session-event/normalization-session-event-entity';

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

    // Get the session owner
    const startedByUserId = await getNormalizationSessionOwner(db, sessionId);
    if (!startedByUserId) {
      logger.error('Normalization session not found', { sessionId });
      throw new Error(`Normalization session not found: ${sessionId}`);
    }

    // Load the current projection
    const projectionDb = new NormalizationSessionProjectionDb(db, logger);
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
    await db.transaction(async (tx) => {
      // 1. Load input artifacts
      const inputArtifacts = await tx
        .select()
        .from(schema.artifacts)
        .where(
          and(
            inArray(schema.artifacts.id, inProgressEntry.inputArtifactIds),
            isNull(schema.artifacts.deleted),
          ),
        );

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

        // Clone the artifact with a new ID and updated timestamps
        const clonedArtifact = {
          ...inputArtifact,
          id: outputArtifactId,
          created_at: now,
          updated_at: now,
        };

        await tx.insert(schema.artifacts).values(clonedArtifact);
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
