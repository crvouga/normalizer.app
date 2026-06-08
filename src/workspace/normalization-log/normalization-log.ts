import { z } from 'zod';

const logLevelSchema = z.enum(['error', 'warn', 'info', 'debug']);

const schema = z.object({
  seq: z.number(),
  level: logLevelSchema,
  scope: z.string(),
  message: z.string(),
  meta: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
});

export type NormalizationLog = z.infer<typeof schema>;
export type NormalizationLogLevel = z.infer<typeof logLevelSchema>;

export const NormalizationLog = {
  schema,
  logLevelSchema,
};
