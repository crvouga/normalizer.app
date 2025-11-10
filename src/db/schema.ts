import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const artifactStatusEnum = pgEnum('artifact_status', ['pending', 'uploaded']);
export const userTypeEnum = pgEnum('user_type', ['anonymous', 'authenticated']);

export const artifacts = pgTable('artifacts', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  content_type: text('content_type').notNull(),
  size: integer('size').notNull(),
  file_type: text('file_type').notNull(),
  status: artifactStatusEnum('status').notNull(),
  s3_bucket: text('s3_bucket').notNull(),
  s3_key: text('s3_key').notNull(),

  // Common extra metadata
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),

  // Upload metadata
  uploaded_by_user_id: text('uploaded_by_user_id'),
  upload_ip: text('upload_ip'),

  // File info
  sha256: text('sha256'),
  download_url: text('download_url'),
  download_url_expires_at: timestamp('download_url_expires_at'),

  // Upload URL metadata
  upload_url: text('upload_url'),
  upload_url_expires_at: timestamp('upload_url_expires_at'),

  // Application/domain-specific
  name: text('name'),
  tags: jsonb('tags').$type<string[]>(),
  description: text('description'),

  // Soft delete marker
  deleted: boolean('deleted'),
});

export type IArtifact = typeof artifacts.$inferSelect;

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  type: userTypeEnum('type').notNull(),
  name: text('name'),
  email: text('email').unique(),
  google_id: text('google_id').unique(),
  profile_picture: text('profile_picture'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export type IUser = typeof users.$inferSelect;

export const userSessions = pgTable('user_sessions', {
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull(),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id),
  started_at: timestamp('started_at').notNull().defaultNow(),
  ended_at: timestamp('ended_at'),
});

export type IUserSession = typeof userSessions.$inferSelect;

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.user_id],
    references: [users.id],
  }),
}));
