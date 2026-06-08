#!/usr/bin/env bun

import { execSync } from 'node:child_process';
import { normalizeEnvAliases } from '../src/lib/secrets/normalize-env-aliases';
import { scrubUnsafeTestEnv } from '../src/test/assert-safe-database-url';
import { applyDefaultTestEnv } from '../src/test/test-env-defaults';
import {
  removeTestDatabaseUrlFile,
  startTestDatabase,
  stopTestDatabase,
  writeTestDatabaseUrlFile,
} from '../src/test/test-database';
import {
  removeTestMinioEndpointFile,
  startTestMinio,
  stopTestMinio,
  writeTestMinioEndpointFile,
} from '../src/test/test-minio';

scrubUnsafeTestEnv();
applyDefaultTestEnv();

/** Embedded-postgres orphans from crashed runs exhaust macOS shared memory segments. */
function cleanupOrphanedTestPostgres(): void {
  try {
    execSync('pkill -f normalizer-test-pg', { stdio: 'ignore' });
  } catch {
    // No matching processes — expected on a clean machine.
  }
}

cleanupOrphanedTestPostgres();

let cleaned = false;

async function cleanup(): Promise<void> {
  if (cleaned) {
    return;
  }
  cleaned = true;
  await removeTestDatabaseUrlFile();
  await removeTestMinioEndpointFile();
  await stopTestDatabase();
  await stopTestMinio();
}

function onSignal(code: number): void {
  void cleanup().finally(() => process.exit(code));
}

process.on('SIGINT', () => onSignal(130));
process.on('SIGTERM', () => onSignal(143));

await startTestDatabase();
await startTestMinio();
await writeTestDatabaseUrlFile();
await writeTestMinioEndpointFile();
normalizeEnvAliases();

const args = process.argv.slice(2);
const proc = Bun.spawn([process.execPath, 'test', ...args], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
  env: process.env,
});

const exitCode = await proc.exited;
await cleanup();
process.exit(exitCode);
