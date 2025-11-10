import { z } from 'zod';

const schema = z.enum(['anonymous', 'authenticated']);

export type UserType = z.infer<typeof schema>;

export const UserType = {
  schema,
};
