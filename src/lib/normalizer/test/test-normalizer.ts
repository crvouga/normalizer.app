import { expect } from 'bun:test';
import { type Logger } from '../../logger';
import type { ObjectStore } from '../../object-store/object-store';
import { unwrap } from '../../result';
import { Normalizer } from '../normalizer';

export async function testNormalizer<TInput, TTarget>(params: {
  normalizer: Normalizer;
  objectStore: ObjectStore;
  targetFile: TTarget[];
  inputFile: TInput[];
  expectedOutputFile: TTarget[];
  testBucket: string;
  logger: Logger;
  customAssertions?: (actual: TTarget[], expected: TTarget[]) => void;
}) {
  const {
    normalizer,
    objectStore,
    targetFile,
    inputFile,
    expectedOutputFile,
    testBucket,
    logger,
    customAssertions,
  } = params;
  const testId = Math.random().toString(36).substring(2, 15);

  logger.debug('Writing target file', {
    key: `files/target-${testId}.json`,
    targetFile,
  });
  const targetWriteResult = unwrap(
    await objectStore.write({
      bucket: testBucket,
      key: `files/target-${testId}.json`,
      data: intoJsonBuffer(targetFile),
      contentType: 'application/json',
    }),
  );

  logger.debug('Writing input file', {
    key: `files/input-${testId}.json`,
    inputFile,
  });
  const inputWriteResult = unwrap(
    await objectStore.write({
      bucket: testBucket,
      key: `files/input-${testId}.json`,
      data: intoJsonBuffer(inputFile),
      contentType: 'application/json',
    }),
  );

  logger.debug('Invoking normalizer', {
    targets: [targetWriteResult.key],
    inputs: [inputWriteResult.key],
    outputObjectKeyPrefix: `files/normalized-${testId}/`,
    outputObjectBucket: testBucket,
  });
  const normalized = unwrap(
    await normalizer.normalize({
      targets: [targetWriteResult],
      inputs: [inputWriteResult],
      outputObjectKeyPrefix: `files/normalized-${testId}/`,
      outputObjectBucket: testBucket,
    }),
  );
  logger.debug('Normalizer output', {
    normalizedOutputs: normalized.outputs.map((o) => o.key),
  });

  logger.debug('Reading normalized output', {
    key: normalized.outputs[0]!.key,
  });
  const outputRead = unwrap(
    await objectStore.read({
      bucket: testBucket,
      key: normalized.outputs[0]!.key,
    }),
  );
  const actualOutputFile = fromJsonBuffer<TTarget[]>(outputRead);

  logger.debug('Comparing actual output file to expected', {
    actualOutputFile,
    expectedOutputFile,
  });

  if (customAssertions) {
    customAssertions(actualOutputFile, expectedOutputFile);
  } else {
    expect(actualOutputFile).toEqual(expectedOutputFile);
  }

  logger.debug('Cleaning up test files', {
    files: [targetWriteResult.key, inputWriteResult.key, normalized.outputs[0]!.key],
  });
  await objectStore.delete({
    bucket: testBucket,
    key: targetWriteResult.key,
  });
  await objectStore.delete({
    bucket: testBucket,
    key: inputWriteResult.key,
  });
  await objectStore.delete({
    bucket: testBucket,
    key: normalized.outputs[0]!.key,
  });
}

function intoJsonBuffer<T>(data: T): Buffer {
  return Buffer.from(JSON.stringify(data));
}

function fromJsonBuffer<T>(data: Buffer): T {
  return JSON.parse(data.toString());
}
