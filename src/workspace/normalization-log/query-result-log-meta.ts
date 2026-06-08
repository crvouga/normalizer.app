import { z } from 'zod';

export const queryResultLogMetaSchema = z.object({
  resultType: z.enum(['rows', 'command', 'error', 'generic']),
  query: z.string().optional(),
  rows: z.array(z.record(z.unknown())).optional(),
  totalRowCount: z.number().optional(),
  truncated: z.boolean().optional(),
  rowCount: z.number().optional(),
  error: z.string().optional(),
  rawResult: z.unknown().optional(),
});

export type QueryResultLogMeta = z.infer<typeof queryResultLogMetaSchema>;

export function parseQueryResultLogMeta(
  meta: Record<string, unknown> | undefined,
): QueryResultLogMeta | null {
  if (!meta) {
    return null;
  }

  const parsed = queryResultLogMetaSchema.safeParse(meta);
  return parsed.success ? parsed.data : null;
}
