import { describe, expect, test } from 'bun:test';
import { createObjectStore } from '~/src/shared/s3';
import { createLLMOpenAI, isOpenAIEnabled } from '../llm/llm-open-ai';
import { createLogger } from '../logger';
import { createNormalizer } from './normalizer';
import { testNormalizer } from './test/test-normalizer';

describe.if(isOpenAIEnabled())('Normalizer', async () => {
  const logger = createLogger({ noop: false });
  const testBucket = 'test-normalizer';
  const objectStore = await createObjectStore({ logger });
  await objectStore.ensureBucketExists(testBucket);
  const llm = createLLMOpenAI({ logger, model: 'gpt-5-nano' });
  const normalizer = createNormalizer({ objectStore, logger, llm });

  test(
    'it should work 1',
    async () => {
      await testNormalizer({
        normalizer,
        objectStore,
        testBucket,
        logger,
        inputFile: [
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
        ],
        targetFile: [
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
        ],
        expectedOutputFile: [
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
        ],
      });
    },
    Infinity,
  );

  test(
    'it should work 2',
    async () => {
      await testNormalizer({
        normalizer,
        objectStore,
        testBucket,
        logger,
        inputFile: [
          {
            id: 'ENG 101',
            title: 'Introduction to English',
            description: 'This is a description of the course',
            instructor_id: '1234567890',
            instructor_name: 'Jane Doe',
            instructor_email: 'jane.doe@example.com',
            instructor_phone: '098-765-4321',
            instructor_office: '456 Main St, Anytown, USA',
            instructor_office_hours: '12:00-13:00',
          },
        ],
        targetFile: [
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
        ],
        expectedOutputFile: [
          {
            CourseSubject: 'ENG',
            CourseNumber: '101',
            CourseName: 'Introduction to English',
            CourseDescription: 'This is a description of the course',
            CourseInstructor: 'Jane Doe',
            CourseInstructorEmail: 'jane.doe@example.com',
            CourseInstructorPhone: '098-765-4321',
            CourseInstructorOffice: '456 Main St, Anytown, USA',
            CourseInstructorOfficeHours: '12:00-13:00',
          },
        ],
        customAssertions(actual, expected) {
          expect(actual).toHaveLength(1);
          const actualItem = actual[0]!;
          const expectedItem = expected[0]!;
          expect(actualItem.CourseName).toBe(expectedItem.CourseName);
          expect(actualItem.CourseDescription).toBe(expectedItem.CourseDescription);
          expect(actualItem.CourseInstructor).toBe(expectedItem.CourseInstructor);
          expect(actualItem.CourseInstructorEmail).toBe(expectedItem.CourseInstructorEmail);
          expect(actualItem.CourseInstructorPhone).toBe(expectedItem.CourseInstructorPhone);
          expect(actualItem.CourseInstructorOffice).toBe(expectedItem.CourseInstructorOffice);
          expect(actualItem.CourseInstructorOfficeHours).toBe(
            expectedItem.CourseInstructorOfficeHours,
          );
          expect(actualItem.CourseSubject).toBe(expectedItem.CourseSubject);
          expect(actualItem.CourseNumber).toBe(expectedItem.CourseNumber);
        },
      });
    },
    Infinity,
  );

  test(
    'it should work 2 (tricky mapping: constructing ID from subject/number, splitting name)',
    async () => {
      await testNormalizer({
        normalizer,
        objectStore,
        testBucket,
        logger,
        inputFile: [
          {
            subject: 'BIO',
            number: '200',
            name: 'General Biology',
            description: 'An introductory biology course',
            instructor_full: 'Ann Lee',
            instructor_email: 'alee@school.edu',
          },
        ],
        targetFile: [
          {
            id: 'BIO-200',
            CourseSubject: 'BIO',
            CourseNumber: '200',
            CourseName: 'General Biology',
            CourseDescription: 'An introductory biology course',
            InstructorFirst: 'Ann',
            InstructorLast: 'Lee',
            InstructorEmail: 'alee@school.edu',
          },
        ],
        expectedOutputFile: [
          {
            id: 'BIO-200',
            CourseSubject: 'BIO',
            CourseNumber: '200',
            CourseName: 'General Biology',
            CourseDescription: 'An introductory biology course',
            InstructorFirst: 'Ann',
            InstructorLast: 'Lee',
            InstructorEmail: 'alee@school.edu',
          },
        ],
        customAssertions(actual, expected) {
          expect(actual).toHaveLength(1);
          const actualItem = actual[0]!;
          const expectedItem = expected[0]!;
          expect(actualItem.CourseSubject).toBe(expectedItem.CourseSubject);
          expect(actualItem.CourseNumber).toBe(expectedItem.CourseNumber);
          expect(actualItem.CourseName).toBe(expectedItem.CourseName);
          expect(actualItem.CourseDescription).toBe(expectedItem.CourseDescription);
          expect(actualItem.InstructorFirst).toBe(expectedItem.InstructorFirst);
          expect(actualItem.InstructorLast).toBe(expectedItem.InstructorLast);
          expect(actualItem.InstructorEmail).toBe(expectedItem.InstructorEmail);
          expect(actualItem.id).toBe(expectedItem.id);
        },
      });
    },
    Infinity,
  );

  test(
    'it should handle tricky transformations: dates, nulls, calculations, and complex mappings',
    async () => {
      await testNormalizer({
        normalizer,
        objectStore,
        testBucket,
        logger,
        inputFile: [
          {
            order_id: 'ORD-001',
            date_placed: '2024-01-15T10:30:00Z',
            customer_first: 'John',
            customer_middle: 'Michael',
            customer_last: 'Smith',
            customer_email: 'john.smith@email.com',
            product_name: 'Widget Pro',
            price_per_unit: '29.99',
            qty: 3,
            street: '123 Main St',
            suite: 'Suite 100',
            city: 'New York',
            state: 'NY',
            zip: '10001',
            status: 'processing',
          },
        ],
        targetFile: [
          {
            OrderID: 'ORD-001',
            OrderDate: '2024-01-15',
            CustomerFullName: 'John Michael Smith',
            CustomerEmail: 'john.smith@email.com',
            ItemName: 'Widget Pro',
            UnitPrice: 29.99,
            Quantity: 3,
            LineTotal: 89.97,
            DiscountPercent: 10,
            FinalTotal: 80.97,
            ShippingAddress: '123 Main St, Suite 100, New York, NY 10001',
            OrderStatus: 'PROCESSING',
          },
        ],
        expectedOutputFile: [
          {
            OrderID: 'ORD-001',
            OrderDate: '2024-01-15',
            CustomerFullName: 'John Michael Smith',
            CustomerEmail: 'john.smith@email.com',
            ItemName: 'Widget Pro',
            UnitPrice: 29.99,
            Quantity: 3,
            LineTotal: 89.97,
            DiscountPercent: 0,
            FinalTotal: 89.97,
            ShippingAddress: '123 Main St, Suite 100, New York, NY 10001',
            OrderStatus: 'PROCESSING',
          },
        ],
        customAssertions(actual, expected) {
          expect(actual).toHaveLength(1);
          const actualItem = actual[0]!;
          const expectedItem = expected[0]!;
          expect(actualItem.OrderID).toBe(expectedItem.OrderID);
          compareDates(actualItem.OrderDate, expectedItem.OrderDate);
          expect(actualItem.CustomerFullName).toBe(expectedItem.CustomerFullName);
          expect(actualItem.CustomerEmail).toBe(expectedItem.CustomerEmail);
          expect(actualItem.ItemName).toBe(expectedItem.ItemName);
          expect(toFloat(actualItem.UnitPrice)).toBeCloseTo(expectedItem.UnitPrice, 2);
          expect(toInt(actualItem.Quantity)).toBe(expectedItem.Quantity);
          expect(toFloat(actualItem.LineTotal)).toBeCloseTo(expectedItem.LineTotal, 2);
          expect(toFloat(actualItem.DiscountPercent)).toBe(expectedItem.DiscountPercent);
          expect(toFloat(actualItem.FinalTotal)).toBeCloseTo(expectedItem.FinalTotal, 2);
          expect(actualItem.ShippingAddress).toBe(expectedItem.ShippingAddress);
          compareCaseInsensitive(actualItem.OrderStatus, expectedItem.OrderStatus);
        },
      });
    },
    Infinity,
  );
});

function toFloat(value: string | number): number {
  return typeof value === 'string' ? parseFloat(value) : value;
}

function toInt(value: string | number): number {
  return typeof value === 'string' ? parseInt(value, 10) : value;
}

function compareDates(actual: string, expected: string) {
  const actualDate = new Date(actual).toISOString().split('T')[0];
  const expectedDate = new Date(expected).toISOString().split('T')[0];
  expect(actualDate).toBe(expectedDate);
}

function compareCaseInsensitive(actual: string, expected: string) {
  expect(String(actual).toUpperCase()).toBe(String(expected).toUpperCase());
}
