import { describe, expect, test } from 'bun:test';
import { createObjectStore } from '~/src/shared/s3';
import { createLLMOpenAI, isOpenAIEnabled } from '../llm/llm-open-ai';
import { createLogger } from '../logger';
import { unwrap } from '../result';
import { createNormalizer } from './normalizer';

describe.if(isOpenAIEnabled())('Normalizer', async () => {
  const logger = createLogger({ noop: false });
  const testBucket = 'test-normalizer';
  const objectStore = await createObjectStore({ logger });
  await objectStore.ensureBucketExists(testBucket);
  const llm = createLLMOpenAI({ logger, model: 'gpt-5' });
  const normalizer = createNormalizer({ objectStore, logger, llm });

  test(
    'it should work 1',
    async () => {
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
      logger.debug('expectedOutputFile', {
        expectedOutputFile: JSON.stringify(expectedOutputFile),
      });
      const targetWriteResult = unwrap(
        await objectStore.write({
          bucket: testBucket,
          key: 'files/target.json',
          data: intoJsonBuffer(targetFile),
          contentType: 'application/json',
        }),
      );
      const inputWriteResult = unwrap(
        await objectStore.write({
          bucket: testBucket,
          key: 'files/input.json',
          data: intoJsonBuffer(inputFile),
          contentType: 'application/json',
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
      const outputRead = unwrap(
        await objectStore.read({
          bucket: testBucket,
          key: normalized.outputs[0]!.key,
        }),
      );
      const actualOutputFile = fromJsonBuffer(outputRead);
      expect(actualOutputFile).toEqual(expectedOutputFile);
    },
    Infinity,
  );

  test(
    'it should work 2',
    async () => {
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
      ];
      const expectedOutputFile: Target[] = [
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
      ];
      logger.debug('expectedOutputFile', {
        expectedOutputFile: JSON.stringify(expectedOutputFile),
      });
      const targetWriteResult = unwrap(
        await objectStore.write({
          bucket: testBucket,
          key: 'files/target-1.json',
          data: intoJsonBuffer(targetFile),
          contentType: 'application/json',
        }),
      );
      const inputWriteResult = unwrap(
        await objectStore.write({
          bucket: testBucket,
          key: 'files/input-1.json',
          data: intoJsonBuffer(inputFile),
          contentType: 'application/json',
        }),
      );
      const normalized = unwrap(
        await normalizer.normalize({
          targets: [targetWriteResult],
          inputs: [inputWriteResult],
          outputObjectKeyPrefix: 'files/normalized-1/',
          outputObjectBucket: testBucket,
        }),
      );
      const outputRead = unwrap(
        await objectStore.read({
          bucket: testBucket,
          key: normalized.outputs[0]!.key,
        }),
      );
      const actualOutputFile = fromJsonBuffer(outputRead);
      expect(actualOutputFile).toEqual(expectedOutputFile);
    },
    Infinity,
  );

  test(
    'it should work 2 (tricky mapping: constructing ID from subject/number, splitting name)',
    async () => {
      const targetFile = [
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
      ];
      type Target = (typeof targetFile)[number];
      const inputFile = [
        {
          subject: 'BIO',
          number: '200',
          name: 'General Biology',
          description: 'An introductory biology course',
          instructor_full: 'Ann Lee',
          instructor_email: 'alee@school.edu',
        },
      ];
      const expectedOutputFile: Target[] = [
        {
          id: 'BIO-200', // Combined subject and number field into id
          CourseSubject: 'BIO',
          CourseNumber: '200',
          CourseName: 'General Biology',
          CourseDescription: 'An introductory biology course',
          InstructorFirst: 'Ann', // Split full name
          InstructorLast: 'Lee', // Split full name
          InstructorEmail: 'alee@school.edu',
        },
      ];
      logger.debug('expectedOutputFile', {
        expectedOutputFile: JSON.stringify(expectedOutputFile),
      });
      const targetWriteResult = unwrap(
        await objectStore.write({
          bucket: testBucket,
          key: 'files/target-2.json',
          data: intoJsonBuffer(targetFile),
          contentType: 'application/json',
        }),
      );
      const inputWriteResult = unwrap(
        await objectStore.write({
          bucket: testBucket,
          key: 'files/input-2.json',
          data: intoJsonBuffer(inputFile),
          contentType: 'application/json',
        }),
      );
      const normalized = unwrap(
        await normalizer.normalize({
          targets: [targetWriteResult],
          inputs: [inputWriteResult],
          outputObjectKeyPrefix: 'files/normalized-2/',
          outputObjectBucket: testBucket,
        }),
      );
      const outputRead = unwrap(
        await objectStore.read({
          bucket: testBucket,
          key: normalized.outputs[0]!.key,
        }),
      );
      const actualOutputFile = fromJsonBuffer(outputRead);
      expect(actualOutputFile).toEqual(expectedOutputFile);
    },
    Infinity,
  );

  test(
    'it should handle tricky transformations: dates, nulls, calculations, and complex mappings',
    async () => {
      // Target schema expects: formatted dates, computed totals, full names, and handles nulls
      const targetFile = [
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
      ];
      type Target = (typeof targetFile)[number];

      // Input has: different date format, separate name fields, price as string, missing discount, different address format
      const inputFile = [
        {
          order_id: 'ORD-001',
          date_placed: '2024-01-15T10:30:00Z', // ISO timestamp needs parsing
          customer_first: 'John',
          customer_middle: 'Michael',
          customer_last: 'Smith',
          customer_email: 'john.smith@email.com',
          product_name: 'Widget Pro',
          price_per_unit: '29.99', // String that needs conversion
          qty: 3,
          // No discount field - should default to 0 or handle null
          street: '123 Main St',
          suite: 'Suite 100',
          city: 'New York',
          state: 'NY',
          zip: '10001',
          status: 'processing', // lowercase needs uppercase conversion
        },
      ];

      const expectedOutputFile: Target[] = [
        {
          OrderID: 'ORD-001',
          OrderDate: '2024-01-15', // Extract date from ISO timestamp
          CustomerFullName: 'John Michael Smith', // Concatenate first + middle + last
          CustomerEmail: 'john.smith@email.com',
          ItemName: 'Widget Pro',
          UnitPrice: 29.99, // Convert string to number
          Quantity: 3,
          LineTotal: 89.97, // Calculate: UnitPrice * Quantity = 29.99 * 3
          DiscountPercent: 0, // Missing in input, should default to 0
          FinalTotal: 89.97, // Calculate: LineTotal * (1 - DiscountPercent/100) = 89.97 * 1.0
          ShippingAddress: '123 Main St, Suite 100, New York, NY 10001', // Concatenate address parts
          OrderStatus: 'PROCESSING', // Convert to uppercase
        },
      ];

      logger.debug('Tricky test - expectedOutputFile', {
        expectedOutputFile: JSON.stringify(expectedOutputFile, null, 2),
      });

      const targetWriteResult = unwrap(
        await objectStore.write({
          bucket: testBucket,
          key: 'files/target-tricky.json',
          data: intoJsonBuffer(targetFile),
          contentType: 'application/json',
        }),
      );
      const inputWriteResult = unwrap(
        await objectStore.write({
          bucket: testBucket,
          key: 'files/input-tricky.json',
          data: intoJsonBuffer(inputFile),
          contentType: 'application/json',
        }),
      );
      const normalized = unwrap(
        await normalizer.normalize({
          targets: [targetWriteResult],
          inputs: [inputWriteResult],
          outputObjectKeyPrefix: 'files/normalized-tricky/',
          outputObjectBucket: testBucket,
        }),
      );
      const outputRead = unwrap(
        await objectStore.read({
          bucket: testBucket,
          key: normalized.outputs[0]!.key,
        }),
      );
      const actualOutputFile = fromJsonBuffer<Target[]>(outputRead);

      // Use toEqual with number tolerance for floating point calculations
      expect(actualOutputFile).toHaveLength(1);
      expect(actualOutputFile[0]!.OrderID).toBe(expectedOutputFile[0]!.OrderID);
      expect(actualOutputFile[0]!.OrderDate).toBe(expectedOutputFile[0]!.OrderDate);
      expect(actualOutputFile[0]!.CustomerFullName).toBe(expectedOutputFile[0]!.CustomerFullName);
      expect(actualOutputFile[0]!.CustomerEmail).toBe(expectedOutputFile[0]!.CustomerEmail);
      expect(actualOutputFile[0]!.ItemName).toBe(expectedOutputFile[0]!.ItemName);
      expect(actualOutputFile[0]!.UnitPrice).toBeCloseTo(expectedOutputFile[0]!.UnitPrice, 2);
      expect(actualOutputFile[0]!.Quantity).toBe(expectedOutputFile[0]!.Quantity);
      expect(actualOutputFile[0]!.LineTotal).toBeCloseTo(expectedOutputFile[0]!.LineTotal, 2);
      expect(actualOutputFile[0]!.DiscountPercent).toBe(expectedOutputFile[0]!.DiscountPercent);
      expect(actualOutputFile[0]!.FinalTotal).toBeCloseTo(expectedOutputFile[0]!.FinalTotal, 2);
      expect(actualOutputFile[0]!.ShippingAddress).toBe(expectedOutputFile[0]!.ShippingAddress);
      expect(actualOutputFile[0]!.OrderStatus).toBe(expectedOutputFile[0]!.OrderStatus);
    },
    Infinity,
  );
});

const intoJsonBuffer = <T>(data: T): Buffer => {
  return Buffer.from(JSON.stringify(data));
};

const fromJsonBuffer = <T>(data: Buffer): T => {
  return JSON.parse(data.toString());
};
