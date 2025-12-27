import { describe, expect, test } from 'bun:test';
import { ArtifactDb } from '~/src/artifacts/artifact-db';
import { ArtifactId } from '~/src/artifacts/artifact-id';
import * as schema from '~/src/db/schema';
import { isOpenAIEnabled } from '~/src/lib/llm/llm-open-ai';
import { createLogger } from '~/src/lib/logger';
import { unwrap } from '~/src/lib/result';
import { NormalizationRunId } from '~/src/normalization-session/normalization-run-id';
import { NormalizationSessionEventDb } from '~/src/normalization-session/normalization-session-event/normalization-session-event-db';
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

      const eventDb = new NormalizationSessionEventDb(db, logger);

      await eventDb.append({
        id: NormalizationSessionEventId.generate(),
        normalization_session_id: sessionId,
        event: {
          type: 'user-started-session',
          sessionId,
          targetArtifactIds: [targetArtifactId],
          startedAt: new Date(),
          startedByUserId: userId,
        },
        created_at: new Date(),
      });

      await eventDb.append({
        id: NormalizationSessionEventId.generate(),
        normalization_session_id: sessionId,
        event: {
          type: 'user-requested-normalization',
          sessionId,
          inputArtifactIds: [inputArtifactId],
          requestedAt: new Date(),
          requestedByUserId: userId,
          normalizationRunId,
        },
        created_at: new Date(),
      });

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
      expect(outputArtifact.object_key).not.toBe(inputKey);
      expect(outputArtifact.name).toBeDefined();
      expect(outputArtifact.uploaded_by).toBe('system');

      // Download and verify output artifact schema matches target schema
      const outputReadResult = unwrap(
        await objectStore.read({
          bucket: outputArtifact.object_bucket,
          key: outputArtifact.object_key,
        }),
      );

      // Parse output file (assuming JSON format based on target format)
      const outputData = JSON.parse(outputReadResult.toString('utf-8'));
      expect(Array.isArray(outputData)).toBe(true);
      expect(outputData.length).toBeGreaterThan(0);

      // Extract schema (keys) from target and output
      const targetSchema = new Set(Object.keys(targetFile[0]!));
      const outputSchema = new Set(Object.keys(outputData[0]!));

      // Assert schemas match
      expect(outputSchema.size).toBe(targetSchema.size);
      for (const key of targetSchema) {
        if (!outputSchema.has(key)) {
          throw new Error(
            `Output schema missing key: ${key}. Output has keys: ${Array.from(outputSchema).join(', ')}`,
          );
        }
      }
      for (const key of outputSchema) {
        if (!targetSchema.has(key)) {
          throw new Error(
            `Output schema has extra key: ${key}. Target has keys: ${Array.from(targetSchema).join(', ')}`,
          );
        }
      }

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
      await objectStore.delete({ bucket: testBucket, key: inputKey });
      await objectStore.delete({ bucket: testBucket, key: targetKey });

      // Clean up output artifact
      if (outputArtifact.object_key) {
        await objectStore.delete({
          bucket: outputArtifact.object_bucket,
          key: outputArtifact.object_key,
        });
      }
    },
    Infinity,
  );
});

function intoJsonBuffer<T>(data: T): Buffer {
  return Buffer.from(JSON.stringify(data));
}
