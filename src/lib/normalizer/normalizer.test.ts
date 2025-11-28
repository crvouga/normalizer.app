import { describe, expect, test } from 'bun:test';
import { createObjectStore } from '~/src/shared/s3';
import { createLLMOpenAI, isOpenAIEnabled } from '../llm/llm-open-ai';
import { createLogger } from '../logger';
import { unwrap } from '../result';
import { createNormalizer } from './normalizer';

describe.if(isOpenAIEnabled())('Normalizer', async () => {
  const logger = createLogger({ noop: true });
  const testBucket = 'test-normalizer';
  const objectStore = await createObjectStore({ logger });
  await objectStore.ensureBucketExists(testBucket);
  const llm = createLLMOpenAI({ logger });
  const normalizer = createNormalizer({ objectStore, logger, llm });

  test('normalize: should be implemented', async () => {
    const targetFile = [
      {
        CourseSubject: 'MATH',
        CourseNumber: '101',
        CourseName: 'Introduction to Mathematics',
        CourseDescription: 'This is a description of the course',
        CourseInstructor: 'John Doe',
        CourseInstructorEmail: 'john.doe@example.com',
        CourseInstructorPhone: '123-456-7890',
        CourseInstructorOffice: '123 Main St, Anytown, USA',
        CourseInstructorOfficeHours: '10:00-11:00',
      },
    ];
    type Target = (typeof targetFile)[number];
    const inputFile = [
      {
        subject: 'English',
        number: '101',
        name: 'Introduction to English',
        description: 'This is a description of the course',
        instructor_name: 'Jane Doe',
        instructor_email: 'jane.doe@example.com',
        instructor_phone: '098-765-4321',
        instructor_office: '456 Main St, Anytown, USA',
        instructor_office_hours: '12:00-13:00',
      },
    ];
    const expectedOutputFile: Target[] = [
      {
        CourseSubject: 'English',
        CourseNumber: '101',
        CourseName: 'Introduction to English',
        CourseDescription: 'This is a description of the course',
        CourseInstructor: 'Jane Doe',
        CourseInstructorEmail: 'jane.doe@example.com',
        CourseInstructorPhone: '098-765-4321',
        CourseInstructorOffice: '456 Main St, Anytown, USA',
        CourseInstructorOfficeHours: '12:00-13:00',
      },
    ];
    logger.debug('expectedOutputFile', { expectedOutputFile: JSON.stringify(expectedOutputFile) });
    const targetWriteResult = unwrap(
      await objectStore.write({
        bucket: testBucket,
        key: 'files/target.json',
        data: intoJsonBuffer(targetFile),
      }),
    );
    const inputWriteResult = unwrap(
      await objectStore.write({
        bucket: testBucket,
        key: 'files/input.json',
        data: intoJsonBuffer(inputFile),
      }),
    );
    const normalized = unwrap(
      await normalizer.normalize({
        targets: [targetWriteResult],
        inputs: [inputWriteResult],
        outputObjectKeyPrefix: 'files/normalized/',
        outputObjectBucket: testBucket,
      }),
    );
    unwrap(
      await objectStore.read({
        bucket: testBucket,
        key: normalized.outputs[0]!.key,
      }),
    );
    expect(inputFile).toHaveLength(1);
    expect(targetFile).toHaveLength(1);
    expect(normalizer).toBeDefined();
  });
});

const intoJsonBuffer = <T>(data: T): Buffer => {
  return Buffer.from(JSON.stringify(data));
};
