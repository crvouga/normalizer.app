import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { createLogger } from '../logger';
import type { LLM } from '../llm/llm';
import { createLLMOpenAI, isOpenAIEnabled } from '../llm/llm-open-ai';
import { createObjectStore } from '~/src/shared/s3';
import { isOk } from '../result';
import { createNormalizer, Normalizer } from './normalizer';

describe.skipIf(!isOpenAIEnabled())('Normalizer', () => {
  const logger = createLogger();
  const testBucket = 'test-normalizer';
  let objectStore: Awaited<ReturnType<typeof createObjectStore>>;
  let llm: LLM;
  let normalizer: Normalizer;

  beforeAll(async () => {
    objectStore = await createObjectStore({ logger });
    await objectStore.ensureBucketExists(testBucket);
    llm = createLLMOpenAI({ logger });
    normalizer = createNormalizer({ objectStore, logger, llm });
  });

  beforeEach(async () => {
    // Clean up any leftover test data before each test
    // Delete common test keys that might exist from previous test runs
    // Note: In a real implementation, you might want to list all keys with these prefixes
    // and delete them. For now, we'll clean up specific test keys.
    const testKeys = [
      'normalizer-input/test1.pdf',
      'normalizer-input/test2.pdf',
      'normalizer-target/template.pdf',
      'normalizer-output/test-run-0.pdf',
      'normalizer-output/test-run-1.pdf',
    ];

    for (const key of testKeys) {
      const existsResult = await objectStore.exists({ bucket: testBucket, key });
      if (isOk(existsResult) && existsResult.value) {
        await objectStore.delete({ bucket: testBucket, key });
      }
    }
  });

  test('normalize: should be implemented', async () => {
    // TODO: Add test implementation
    expect(normalizer).toBeDefined();
  });
});
