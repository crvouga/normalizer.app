import { z } from 'zod';

const logLevelSchema = z.enum(['error', 'warn', 'info', 'debug']);
const logKindSchema = z.enum(['progress', 'reasoning', 'error', 'query_result']);

const schema = z.object({
  seq: z.number(),
  kind: logKindSchema.default('progress'),
  level: logLevelSchema,
  scope: z.string(),
  message: z.string(),
  meta: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
});

export type NormalizationLog = z.infer<typeof schema>;
export type NormalizationLogLevel = z.infer<typeof logLevelSchema>;
export type NormalizationLogKind = z.infer<typeof logKindSchema>;

export const NormalizationLog = {
  schema,
  logLevelSchema,
  logKindSchema,
};
