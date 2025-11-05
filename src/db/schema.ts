import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const fileStatusEnum = pgEnum('file_status', ['pending', 'uploaded']);

export const files = pgTable('files', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  content_type: text('content_type').notNull(),
  size: integer('size').notNull(),
  file_type: text('file_type').notNull(),
  status: fileStatusEnum('status').notNull(),
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
  tags: jsonb('tags').$type<string[]>(),
  description: text('description'),

  // Soft delete marker
  deleted: boolean('deleted'),
});

export type IFile = typeof files.$inferSelect;
