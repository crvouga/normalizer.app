import { describe, expect, test, beforeAll, afterEach, afterAll } from 'bun:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ArtifactId } from '../artifacts/artifact-id';
import { UserId } from '../users/user-id';
import { NormalizationRunId } from '../workspace/normalization-run-id';
import { WorkspaceEvent } from '../workspace/workspace-event/workspace-event';
import type { WorkspaceEventPersisted } from '../workspace/workspace-event/workspace-event-persisted';
import { WorkspaceEventPersistedLegacy } from '../workspace/workspace-event/workspace-event-persisted-legacy';
import { WorkspaceEventId } from '../workspace/workspace-event/workspace-event-id';
import { WorkspaceId } from '../workspace/workspace-id';
import * as schema from './schema';
import { migrateWorkspaceEvents } from './migrate-workspace-events';

describe('migrate-workspace-events', () => {
  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
  let postgresConnection: ReturnType<typeof postgres> | null = null;
  let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

  beforeAll(async () => {
    postgresConnection = postgres(databaseUrl);
    db = drizzle(postgresConnection, { schema });
  });

  afterEach(async () => {
    if (db) {
      // Clean up test data after each test
      await db.delete(schema.workspaceEvents);
    }
  });

  afterAll(async () => {
    if (postgresConnection) {
      await postgresConnection.end();
    }
  });

  test('should migrate all workspace events from old format to new format', async () => {
    if (!db || !postgresConnection) {
      throw new Error('Database connection not initialized');
    }

    // Create test data with old format events
    const workspaceId1 = WorkspaceId.generate();
    const workspaceId2 = WorkspaceId.generate();
    const userId1 = UserId.generate();
    const userId2 = UserId.generate();
    const artifactId1 = ArtifactId.generate();
    const artifactId2 = ArtifactId.generate();
    const normalizationRunId1 = NormalizationRunId.generate();
    const normalizationRunId2 = NormalizationRunId.generate();

    // Create legacy format events using the legacy schema
    const legacyEvent1: WorkspaceEventPersistedLegacy = {
      type: 'start-session',
      sessionId: workspaceId1,
      targetArtifactIds: [artifactId1],
      startedAt: new Date('2024-01-01T00:00:00Z'),
      startedByUserId: userId1,
    };

    const legacyEvent2: WorkspaceEventPersistedLegacy = {
      type: 'user-started-session',
      sessionId: workspaceId1,
      targetArtifactIds: [artifactId1, artifactId2],
      startedAt: new Date('2024-01-02T00:00:00Z'),
      startedByUserId: userId2,
    };

    const legacyEvent3: WorkspaceEventPersistedLegacy = {
      type: 'user-requested-normalization',
      sessionId: workspaceId1,
      inputArtifactIds: [artifactId1],
      requestedAt: new Date('2024-01-03T00:00:00Z'),
      requestedByUserId: userId1,
      normalizationRunId: normalizationRunId1,
    };

    const legacyEvent4: WorkspaceEventPersistedLegacy = {
      type: 'user-canceled-normalization',
      sessionId: workspaceId2,
      normalizationRunId: normalizationRunId2,
      canceledAt: new Date('2024-01-04T00:00:00Z'),
      canceledByUserId: userId2,
    };

    const legacyEvent5: WorkspaceEventPersistedLegacy = {
      type: 'system-normalization-completed',
      sessionId: workspaceId1,
      normalizationRunId: normalizationRunId1,
      outputArtifactIds: [artifactId2],
      completedAt: new Date('2024-01-05T00:00:00Z'),
    };

    // Validate legacy events against schema
    expect(WorkspaceEventPersistedLegacy.schema.safeParse(legacyEvent1).success).toBe(true);
    expect(WorkspaceEventPersistedLegacy.schema.safeParse(legacyEvent2).success).toBe(true);
    expect(WorkspaceEventPersistedLegacy.schema.safeParse(legacyEvent3).success).toBe(true);
    expect(WorkspaceEventPersistedLegacy.schema.safeParse(legacyEvent4).success).toBe(true);
    expect(WorkspaceEventPersistedLegacy.schema.safeParse(legacyEvent5).success).toBe(true);

    const oldFormatEvents: Array<{
      id: string;
      workspace_id: string;
      event: WorkspaceEventPersisted;
      created_at: Date;
    }> = [
      {
        id: WorkspaceEventId.generate(),
        workspace_id: workspaceId1,
        event: legacyEvent1,
        created_at: new Date('2024-01-01T00:00:00Z'),
      },
      {
        id: WorkspaceEventId.generate(),
        workspace_id: workspaceId1,
        event: legacyEvent2,
        created_at: new Date('2024-01-02T00:00:00Z'),
      },
      {
        id: WorkspaceEventId.generate(),
        workspace_id: workspaceId1,
        event: legacyEvent3,
        created_at: new Date('2024-01-03T00:00:00Z'),
      },
      {
        id: WorkspaceEventId.generate(),
        workspace_id: workspaceId2,
        event: legacyEvent4,
        created_at: new Date('2024-01-04T00:00:00Z'),
      },
      {
        id: WorkspaceEventId.generate(),
        workspace_id: workspaceId1,
        event: legacyEvent5,
        created_at: new Date('2024-01-05T00:00:00Z'),
      },
      // Add some events that are already in the new format (should be skipped)
      {
        id: WorkspaceEventId.generate(),
        workspace_id: workspaceId2,
        event: {
          type: 'workspace/user-started',
          workspaceId: workspaceId2,
          targetArtifactIds: [artifactId1],
          startedAt: new Date('2024-01-06T00:00:00Z'),
          startedByUserId: userId1,
        },
        created_at: new Date('2024-01-06T00:00:00Z'),
      },
    ];

    // Insert old format events into the database
    await db.insert(schema.workspaceEvents).values(oldFormatEvents as any);

    // Verify initial count
    const initialCount = await db.select().from(schema.workspaceEvents);
    expect(initialCount.length).toBe(oldFormatEvents.length);

    // Run the migration
    await migrateWorkspaceEvents(databaseUrl);

    // Verify final count (should be the same)
    const finalEvents = await db
      .select()
      .from(schema.workspaceEvents)
      .orderBy(schema.workspaceEvents.created_at);
    expect(finalEvents.length).toBe(oldFormatEvents.length);

    // Verify all events are now in the new format (WorkspaceEvent schema)
    // and NOT in the legacy format
    for (const row of finalEvents) {
      // Verify event matches new format schema
      const parseResult = WorkspaceEvent.schema.safeParse(row.event);
      expect(parseResult.success).toBe(true);

      // Verify event does NOT match legacy format schema
      const legacyParseResult = WorkspaceEventPersistedLegacy.schema.safeParse(row.event);
      expect(legacyParseResult.success).toBe(false);
    }

    // Verify legacy events were migrated (check that they're no longer in legacy format)
    const legacyEventIds = [
      oldFormatEvents[0]!.id,
      oldFormatEvents[1]!.id,
      oldFormatEvents[2]!.id,
      oldFormatEvents[3]!.id,
      oldFormatEvents[4]!.id,
    ];

    for (const legacyEventId of legacyEventIds) {
      const migratedEvent = finalEvents.find((e) => e.id === legacyEventId);
      expect(migratedEvent).toBeDefined();
      if (migratedEvent) {
        // Verify it's in the new format
        const newFormatParse = WorkspaceEvent.schema.safeParse(migratedEvent.event);
        expect(newFormatParse.success).toBe(true);

        // Verify it's NOT in the legacy format
        const legacyFormatParse = WorkspaceEventPersistedLegacy.schema.safeParse(
          migratedEvent.event,
        );
        expect(legacyFormatParse.success).toBe(false);
      }
    }
  });

  test('should handle empty table', async () => {
    if (!db) {
      throw new Error('Database connection not initialized');
    }

    // Ensure table is empty
    await db.delete(schema.workspaceEvents);

    // Run migration on empty table
    await migrateWorkspaceEvents(databaseUrl);

    // Verify table is still empty
    const events = await db.select().from(schema.workspaceEvents);
    expect(events.length).toBe(0);
  });

  test('should handle events that are already migrated', async () => {
    if (!db) {
      throw new Error('Database connection not initialized');
    }

    const workspaceId = WorkspaceId.generate();
    const userId = UserId.generate();
    const artifactId = ArtifactId.generate();

    // Insert events that are already in the new format
    const newFormatEvents = [
      {
        id: WorkspaceEventId.generate(),
        workspace_id: workspaceId,
        event: {
          type: 'workspace/user-started' as const,
          workspaceId: workspaceId,
          targetArtifactIds: [artifactId],
          startedAt: new Date('2024-01-01T00:00:00Z'),
          startedByUserId: userId,
        },
        created_at: new Date('2024-01-01T00:00:00Z'),
      },
    ];

    await db.insert(schema.workspaceEvents).values(newFormatEvents as any);

    const initialCount = await db.select().from(schema.workspaceEvents);
    expect(initialCount.length).toBe(1);

    // Run migration
    await migrateWorkspaceEvents(databaseUrl);

    // Verify count is unchanged
    const finalEvents = await db.select().from(schema.workspaceEvents);
    expect(finalEvents.length).toBe(1);

    // Verify event is still valid
    const parsed = WorkspaceEvent.schema.safeParse(finalEvents[0]!.event);
    expect(parsed.success).toBe(true);
  });
});
