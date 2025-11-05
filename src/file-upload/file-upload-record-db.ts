import type { SQL } from 'bun';
import { FileUploadRecord, type IFileUploadRecord } from './file-upload-record';
import type { Logger } from '../lib/logger';

/**
 * A repository/collection-like interface for file upload records.
 */
export class FileUploadRecordDb {
  private sql: SQL;
  private logger: Logger;

  constructor(input: { sql: SQL; logger: Logger }) {
    this.sql = input.sql;
    this.logger = input.logger;
  }

  async migrate(): Promise<void> {
    this.logger.info('Migrating files table if needed');
    await this.sql`
      CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data JSONB NOT NULL DEFAULT '{}'::jsonb
      )
    `;
    this.logger.info('Migration complete');
  }

  /**
   * Adds a file upload record to the collection.
   */
  async add(record: IFileUploadRecord): Promise<void> {
    this.logger.debug('Adding file upload record', { id: record.id });
    await this.sql`
      INSERT INTO files (id, data)
      VALUES (${record.id}, ${JSON.stringify(record)}::jsonb)
    `;
    this.logger.info('File upload record added', { id: record.id });
  }

  /**
   * Gets a file upload record by identifier.
   */
  async get(id: string): Promise<IFileUploadRecord | null> {
    this.logger.debug('Fetching file upload record', { id });
    const result = await this.sql`
      SELECT data FROM files
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!result[0]?.data) {
      this.logger.warn('File upload record not found', { id });
      return null;
    }
    const parsed = FileUploadRecord.safeParse(result[0].data);
    if (!parsed.success) {
      this.logger.error('Data in DB does not match FileUploadRecord schema', {
        id,
        issues: parsed.error.issues,
      });
      throw new Error(
        'Data in DB does not match FileUploadRecord schema: ' + JSON.stringify(parsed.error.issues),
      );
    }
    this.logger.info('Fetched file upload record', { id });
    return parsed.data;
  }

  /**
   * Returns all file upload records in the collection.
   */
  async getAll(): Promise<IFileUploadRecord[]> {
    this.logger.debug('Fetching all file upload records');
    const results = await this.sql`
      SELECT data FROM files
      ORDER BY id DESC
    `;
    const mapped = results.map((r) => {
      const parsed = FileUploadRecord.safeParse(r.data);
      if (!parsed.success) {
        this.logger.error('Data in DB does not match FileUploadRecord schema', {
          issues: parsed.error.issues,
        });
        throw new Error(
          'Data in DB does not match FileUploadRecord schema: ' +
            JSON.stringify(parsed.error.issues),
        );
      }
      return parsed.data;
    });
    this.logger.info('Fetched all file upload records', { count: mapped.length });
    return mapped;
  }

  /**
   * Updates a file as having been uploaded (status = "uploaded" and updates size).
   */
  async updateAsUploaded(id: string, size: number): Promise<void> {
    this.logger.info('Updating file as uploaded', { id, size });
    const result = await this.sql`
      UPDATE files
      SET data = jsonb_set(
        jsonb_set(
          data,
          '{status}',
          '"uploaded"'::jsonb
        ),
        '{size}',
        ${size}::text::jsonb
      )
      WHERE id = ${id}
      RETURNING data
    `;
    if (!result.length) {
      this.logger.error('File not found to update as uploaded', { id });
      throw new Error('File not found');
    }
    this.logger.info('File updated as uploaded', { id, size });
  }

  /**
   * Removes (deletes) a file upload record from the collection.
   * Returns the removed record if it existed, otherwise null.
   */
  async remove(id: string): Promise<IFileUploadRecord | null> {
    this.logger.info('Removing file upload record', { id });
    // Fetch the file first (for S3 deletion needs)
    const result = await this.sql`
      SELECT data FROM files
      WHERE id = ${id}
      LIMIT 1
    `;
    if (!result[0]?.data) {
      this.logger.warn('File upload record not found to remove', { id });
      return null;
    }
    const parsed = FileUploadRecord.parse(result[0].data);

    // Remove from collection (DB)
    await this.sql`
      DELETE FROM files
      WHERE id = ${id}
    `;

    this.logger.info('File upload record removed', { id });
    return parsed;
  }
}
