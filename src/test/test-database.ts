import EmbeddedPostgres from 'embedded-postgres';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { runMigrations } from '../db/migrations';
import { createLogger } from '../lib/logger';

let instance: EmbeddedPostgres | null = null;
let databaseUrl: string | null = null;
let isStopping = false;

export const TEST_DB_URL_FILE = path.join(process.cwd(), '.test-db-url');

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(port);
        });
      } else {
        server.close();
        reject(new Error('Failed to find an available port'));
      }
    });
    server.on('error', reject);
  });
}

export async function startTestDatabase(): Promise<string> {
  if (databaseUrl) {
    return databaseUrl;
  }

  const port = await findAvailablePort();
  const databaseDir = path.join(os.tmpdir(), `normalizer-test-pg-${process.pid}-${Date.now()}`);

  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'password',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });

  await pg.initialise();
  await pg.start();

  const url = `postgresql://postgres:password@127.0.0.1:${port}/postgres`;
  process.env.DATABASE_URL = url;
  process.env.TEST_MANAGED_DATABASE_URL = url;

  const logger = createLogger({ noop: true });
  await runMigrations(logger);

  instance = pg;
  databaseUrl = url;

  process.on('beforeExit', () => {
    void stopTestDatabase();
  });

  return url;
}

export function getTestDatabaseUrl(): string {
  if (!databaseUrl) {
    throw new Error('Test database not started. Ensure test-setup preload ran.');
  }
  return databaseUrl;
}

export async function stopTestDatabase(): Promise<void> {
  if (isStopping || !instance) {
    return;
  }

  isStopping = true;

  try {
    await instance.stop();
  } catch {
    // Best-effort cleanup when the process is exiting.
  } finally {
    instance = null;
    databaseUrl = null;
    delete process.env.DATABASE_URL;
    delete process.env.TEST_MANAGED_DATABASE_URL;
    isStopping = false;
  }
}

export async function writeTestDatabaseUrlFile(): Promise<void> {
  const url = await startTestDatabase();
  await writeFile(TEST_DB_URL_FILE, url, 'utf8');
}

export async function readTestDatabaseUrlFile(): Promise<string | null> {
  try {
    const url = await readFile(TEST_DB_URL_FILE, 'utf8');
    const trimmed = url.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function removeTestDatabaseUrlFile(): Promise<void> {
  try {
    await unlink(TEST_DB_URL_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
