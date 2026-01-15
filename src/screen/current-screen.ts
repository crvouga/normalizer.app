import { z } from 'zod';
import { WorkspaceId } from '../workspace/workspace-id';

export const CurrentScreen = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start-workspace'),
  }),
  z.object({
    type: z.literal('workspace'),
    workspaceId: WorkspaceId.schema,
  }),
]);

export type CurrentScreen = z.infer<typeof CurrentScreen>;
