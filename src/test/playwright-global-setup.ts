import { scrubUnsafeTestEnv } from './assert-safe-database-url';
import { applyDefaultTestEnv } from './test-env-defaults';
import { removeTestDatabaseUrlFile } from './test-database';

export default async function globalSetup(): Promise<void> {
  scrubUnsafeTestEnv();
  applyDefaultTestEnv();
  await removeTestDatabaseUrlFile();
}
