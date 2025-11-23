import { describe, expect, test } from 'bun:test';
import { createObjectStore } from '~/src/shared/s3';
import { createLLMOpenAI, isOpenAIEnabled } from '../llm/llm-open-ai';
import { createLogger } from '../logger';
import { createNormalizer } from './normalizer';

describe.skipIf(!isOpenAIEnabled())('Normalizer', async () => {
  const logger = createLogger();
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
    const inputFile = [
      {
        subject: 'MATH',
        number: '101',
        name: 'Introduction to Mathematics',
        description: 'This is a description of the course',
        instructor_name: 'John Doe',
        instructor_email: 'john.doe@example.com',
        instructor_phone: '123-456-7890',
        instructor_office: '123 Main St, Anytown, USA',
        instructor_officeHours: '10:00-11:00',
      },
    ];
    expect(inputFile).toHaveLength(1);
    expect(targetFile).toHaveLength(1);
    expect(normalizer).toBeDefined();
  });
});
