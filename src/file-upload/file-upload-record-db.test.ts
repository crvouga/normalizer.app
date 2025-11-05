import { describe, it, beforeAll, afterAll, expect, beforeEach } from 'bun:test';
import { FileUploadRecordDb } from './file-upload-record-db';
import { FileUploadRecord, type IFileUploadRecord } from './file-upload-record';
import { createSQL, cleanupSQL } from '../sql';

function createTestLogger(): any {
  // A minimal logger for test output (can be enhanced)
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
}

const testRecords: IFileUploadRecord[] = [
  {
    id: 'fb41f97e-12e1-45cb-b6d6-511b7d6300c1',
    filename: 'file1.txt',
    content_type: 'text/plain',
    size: 123,
    file_type: 'text',
    status: 'pending',
    s3_bucket: 'test-bucket',
    s3_key: 'uploads/file1.txt',
  },
  {
    id: 'a2bbf139-1213-4bc0-b0cc-2a6efb1b1234',
    filename: 'image.png',
    content_type: 'image/png',
    size: 4567,
    file_type: 'image',
    status: 'pending',
    s3_bucket: 'test-bucket',
    s3_key: 'uploads/image.png',
  },
];

let sql: Awaited<ReturnType<typeof createSQL>>;
let db: FileUploadRecordDb;

beforeAll(async () => {
  sql = await createSQL({ logger: createTestLogger() });

  // Clean slate for testing: drop the table if it exists
  await sql`DROP TABLE IF EXISTS files`;

  db = new FileUploadRecordDb({ sql, logger: createTestLogger() });
  await db.migrate();
});

afterAll(async () => {
  await cleanupSQL(createTestLogger());
});

beforeEach(async () => {
  // Clean the files table between tests
  await sql`DELETE FROM files`;
});

describe('FileUploadRecordDb', () => {
  it('adds and gets a file upload record', async () => {
    await db.add(testRecords[0]);

    const retrieved = await db.get(testRecords[0].id);

    expect(retrieved).not.toBeNull();
    expect(retrieved).toEqual(testRecords[0]);
  });

  it('returns null for missing record', async () => {
    const result = await db.get('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('adds multiple records and retrieves them with getAll', async () => {
    await db.add(testRecords[0]);
    await db.add(testRecords[1]);

    const all = await db.getAll();
    // Most recently added should come first (order by id desc, but IDs are not time sorted here)
    expect(all.length).toBe(2);
    // Use .toContainEqual for order-insensitivity
    expect(all).toContainEqual(testRecords[0]);
    expect(all).toContainEqual(testRecords[1]);
  });

  it('updates a file as uploaded', async () => {
    await db.add(testRecords[0]);
    await db.updateAsUploaded(testRecords[0].id, 789);

    const updated = await db.get(testRecords[0].id);
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('uploaded');
    expect(updated?.size).toBe(789);
  });

  it('removes a file upload record', async () => {
    await db.add(testRecords[0]);
    const removed = await db.remove(testRecords[0].id);

    expect(removed).not.toBeNull();
    expect(removed).toEqual(testRecords[0]);

    const stillThere = await db.get(testRecords[0].id);
    expect(stillThere).toBeNull();
  });

  it('gracefully returns null when removing a non-existent record', async () => {
    const removed = await db.remove('22222222-2222-2222-2222-222222222222');
    expect(removed).toBeNull();
  });
});
