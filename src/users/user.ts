import { z } from 'zod';
import { UserId } from './user-id';
import { UserType } from './user-type';

const schema = z.object({
  id: UserId.schema,
  type: UserType.schema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type User = z.infer<typeof schema>;

export const User = {
  schema,
};
