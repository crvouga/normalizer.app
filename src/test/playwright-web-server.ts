import { scrubUnsafeTestEnv } from './assert-safe-database-url';
import { applyDefaultTestEnv } from './test-env-defaults';
import { startTestDatabase, writeTestDatabaseUrlFile } from './test-database';
import { createTestServerEnv } from './test-server-env';

scrubUnsafeTestEnv();
applyDefaultTestEnv();
await startTestDatabase();
await writeTestDatabaseUrlFile();

const port = process.env.PORT ?? '5001';

const serverProcess = Bun.spawn([process.execPath, 'run', 'src/server.tsx'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: createTestServerEnv({ PORT: port }),
});

const exitCode = await serverProcess.exited;
process.exit(exitCode);
