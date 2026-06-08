import { and, eq, gt } from 'drizzle-orm';
import type { Logger } from '~/src/lib/logger';
import type { Db, Tx } from '~/src/shared/db';
import * as schema from '../../db/schema';
import type { NormalizationRunId } from '../normalization-run-id';
import type { WorkspaceId } from '../workspace-id';
import type { NormalizationLog, NormalizationLogLevel } from './normalization-log';

export type NormalizationLogInsert = {
  level: NormalizationLogLevel;
  scope: string;
  message: string;
  meta?: Record<string, unknown>;
};

export class NormalizationLogDb {
  constructor(
    private readonly db: Tx | Db,
    private readonly logger: Logger,
  ) {}

  async insertBatch(input: {
    workspaceId: WorkspaceId;
    normalizationRunId: NormalizationRunId;
    entries: NormalizationLogInsert[];
  }): Promise<NormalizationLog[]> {
    if (input.entries.length === 0) {
      return [];
    }

    const rows = input.entries.map((entry) => ({
      workspace_id: input.workspaceId,
      normalization_run_id: input.normalizationRunId,
      level: entry.level,
      scope: entry.scope,
      message: entry.message,
      meta: entry.meta ?? null,
    }));

    const inserted = await this.db.insert(schema.normalizationLogs).values(rows).returning();

    return inserted.map((row) => ({
      seq: row.seq,
      level: row.level as NormalizationLogLevel,
      scope: row.scope,
      message: row.message,
      meta: row.meta ?? undefined,
      createdAt: row.created_at,
    }));
  }

  async listAfter(input: {
    workspaceId: WorkspaceId;
    normalizationRunId: NormalizationRunId;
    afterSeq?: number;
  }): Promise<NormalizationLog[]> {
    const conditions = [
      eq(schema.normalizationLogs.workspace_id, input.workspaceId),
      eq(schema.normalizationLogs.normalization_run_id, input.normalizationRunId),
    ];

    if (input.afterSeq !== undefined) {
      conditions.push(gt(schema.normalizationLogs.seq, input.afterSeq));
    }

    const rows = await this.db
      .select()
      .from(schema.normalizationLogs)
      .where(and(...conditions))
      .orderBy(schema.normalizationLogs.seq);

    return rows.map((row) => ({
      seq: row.seq,
      level: row.level as NormalizationLogLevel,
      scope: row.scope,
      message: row.message,
      meta: row.meta ?? undefined,
      createdAt: row.created_at,
    }));
  }
}

export function createNormalizationLogDb(params: { db: Tx | Db; logger: Logger }): NormalizationLogDb {
  return new NormalizationLogDb(params.db, params.logger);
}
