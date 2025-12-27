import { describe, expect, test } from 'bun:test';
import { ArtifactDb } from '~/src/artifacts/artifact-db';
import { ArtifactId } from '~/src/artifacts/artifact-id';
import * as schema from '~/src/db/schema';
import { isOpenAIEnabled } from '~/src/lib/llm/llm-open-ai';
import { createLogger } from '~/src/lib/logger';
import { unwrap } from '~/src/lib/result';
import { NormalizationRunId } from '~/src/normalization-session/normalization-run-id';
import { NormalizationSessionEventDb } from '~/src/normalization-session/normalization-session-event/normalization-session-event-db';
import { NormalizationSessionEventEntity } from '~/src/normalization-session/normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionEventId } from '~/src/normalization-session/normalization-session-event/normalization-session-event-id';
import { NormalizationSessionId } from '~/src/normalization-session/normalization-session-id';
import { NormalizationSessionProjectionDb } from '~/src/normalization-session/normalization-session-projection/normalization-session-projection-db';
import { createDb } from '~/src/shared/db';
import { createObjectStore } from '~/src/shared/s3';
import { UserId } from '~/src/users/user-id';
import { normalizationTask } from './normalization-task';

describe.if(isOpenAIEnabled())('NormalizationTask', async () => {
  const logger = createLogger({ noop: true });
  const testBucket = 'test-normalization-task';
  const db = await createDb({ logger });
  const objectStore = await createObjectStore({ logger });
  await objectStore.ensureBucketExists(testBucket);

  test(
    'should normalize input artifacts against target artifacts and create output artifacts',
    async () => {
      // Generate IDs
      const userId = UserId.generate();
      const sessionId = NormalizationSessionId.generate();
      const normalizationRunId = NormalizationRunId.generate();
      const inputArtifactId = ArtifactId.generate();
      const targetArtifactId = ArtifactId.generate();

      // Create test data (single row each)
      const inputFile = [
        {
          subject: 'English',
          number: '101',
          name: 'Introduction to English',
          description: 'This is a description of the course',
          instructor_name: 'Jane Doe',
          instructor_email: 'jane.doe@example.com',
          instructor_phone: '098-765-4321',
          instructor_office: '456 Main St, Anytown, USA',
          instructor_office_hours: '12:00-13:00',
        },
      ];

      const targetFile = [
        {
          CourseSubject: 'MATH',
          CourseNumber: '101',
          CourseName: 'Introduction to Mathematics',
          CourseDescription: 'This is a description of the course',
          CourseInstructor: 'John Doe',
          CourseInstructorEmail: 'john.doe@example.com',
          CourseInstructorPhone: '123-456-7890',
          CourseInstructorOffice: '123 Main St, Anytown, USA',
          CourseInstructorOfficeHours: '10:00-11:00',
        },
      ];

      const testId = Math.random().toString(36).substring(2, 15);
      const inputKey = `files/input-${testId}.json`;
      const targetKey = `files/target-${testId}.json`;

      // Write files to S3
      const inputWriteResult = unwrap(
        await objectStore.write({
          bucket: testBucket,
          key: inputKey,
          data: intoJsonBuffer(inputFile),
          contentType: 'application/json',
        }),
      );

      const targetWriteResult = unwrap(
        await objectStore.write({
          bucket: testBucket,
          key: targetKey,
          data: intoJsonBuffer(targetFile),
          contentType: 'application/json',
        }),
      );

      // Create user
      await db.insert(schema.users).values({
        id: userId,
        type: 'anonymous',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Create artifacts in database
      const artifactDb = new ArtifactDb(db, logger);
      await artifactDb.create({
        id: inputArtifactId,
        filename: 'input.json',
        content_type: 'application/json',
        size: intoJsonBuffer(inputFile).length,
        file_type: 'json',
        status: 'uploaded',
        uploaded_by: 'user',
        object_bucket: inputWriteResult.bucket,
        object_key: inputWriteResult.key,
        uploaded_by_user_id: userId,
      });

      await artifactDb.create({
        id: targetArtifactId,
        filename: 'target.json',
        content_type: 'application/json',
        size: intoJsonBuffer(targetFile).length,
        file_type: 'json',
        status: 'uploaded',
        uploaded_by: 'user',
        object_bucket: targetWriteResult.bucket,
        object_key: targetWriteResult.key,
        uploaded_by_user_id: userId,
      });

      // Create normalization session events
      const eventDb = new NormalizationSessionEventDb(db, logger);
      const startedAt = new Date();

      // Create user-started-session event
      const startEventId = NormalizationSessionEventId.generate();
      const startEvent: NormalizationSessionEventEntity = {
        id: startEventId,
        normalization_session_id: sessionId,
        event: {
          type: 'user-started-session',
          sessionId,
          targetArtifactIds: [targetArtifactId],
          startedAt,
          startedByUserId: userId,
        },
        created_at: startedAt,
      };
      await eventDb.append(startEvent);

      // Create user-requested-normalization event (creates in-progress entry)
      const requestedAt = new Date();
      const requestEventId = NormalizationSessionEventId.generate();
      const requestEvent: NormalizationSessionEventEntity = {
        id: requestEventId,
        normalization_session_id: sessionId,
        event: {
          type: 'user-requested-normalization',
          sessionId,
          inputArtifactIds: [inputArtifactId],
          requestedAt,
          requestedByUserId: userId,
          normalizationRunId,
        },
        created_at: requestedAt,
      };
      await eventDb.append(requestEvent);

      // Refresh projection to ensure it's in the database
      const projectionDb = new NormalizationSessionProjectionDb(db, logger);
      await projectionDb.refresh(sessionId, userId);

      // Call the normalization task handler
      const ctx = { db, logger };
      await normalizationTask(ctx, { sessionId });

      // Verify output artifacts were created
      const projection = await projectionDb.load(sessionId, userId);
      const completedEntry = projection.entries.find(
        (entry) => entry.type === 'normalization' && entry.status === 'completed',
      );

      expect(completedEntry).toBeDefined();
      expect(completedEntry?.normalizationRunId).toBe(normalizationRunId);
      expect(completedEntry?.outputArtifactIds.length).toBeGreaterThan(0);

      // Verify output artifacts exist in database
      const outputArtifacts = await artifactDb.getByIds(completedEntry!.outputArtifactIds);
      expect(outputArtifacts.length).toBe(completedEntry!.outputArtifactIds.length);

      // Verify output artifact has correct properties
      const outputArtifact = outputArtifacts[0]!;
      expect(outputArtifact.object_bucket).toBeDefined();
      expect(outputArtifact.object_key).toBeDefined();
      expect(outputArtifact.name).toBeDefined();
      expect(outputArtifact.uploaded_by).toBe('system');

      // Verify completion event was created
      const events = await eventDb.getBySessionId(sessionId);
      const completionEvent = events.find((e) => e.event.type === 'system-normalization-completed');
      expect(completionEvent).toBeDefined();
      expect(completionEvent?.event.type).toBe('system-normalization-completed');
      if (completionEvent?.event.type === 'system-normalization-completed') {
        expect(completionEvent.event.normalizationRunId).toBe(normalizationRunId);
        expect(completionEvent.event.outputArtifactIds.length).toBeGreaterThan(0);
      }

      // Clean up S3 files
      await objectStore.delete({
        bucket: testBucket,
        key: inputKey,
      });
      await objectStore.delete({
        bucket: testBucket,
        key: targetKey,
      });
    },
    Infinity,
  );
});

function intoJsonBuffer<T>(data: T): Buffer {
  return Buffer.from(JSON.stringify(data));
}
