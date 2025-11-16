import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { zodToJsonSchema } from './zod-to-json-schema';

describe('zodToJsonSchema', () => {
  describe('Basic types', () => {
    test('converts ZodString to string type', () => {
      const schema = z.string();
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({ type: 'string' });
    });

    test('converts ZodNumber to number type', () => {
      const schema = z.number();
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({ type: 'number' });
    });

    test('converts ZodBoolean to boolean type', () => {
      const schema = z.boolean();
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({ type: 'boolean' });
    });

    test('converts ZodNull to null type', () => {
      const schema = z.null();
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({ type: 'null' });
    });
  });

  describe('Arrays', () => {
    test('converts array of strings', () => {
      const schema = z.array(z.string());
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
    });

    test('converts array of numbers', () => {
      const schema = z.array(z.number());
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'array',
        items: { type: 'number' },
      });
    });

    test('converts nested arrays', () => {
      const schema = z.array(z.array(z.string()));
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'string' },
        },
      });
    });
  });

  describe('Objects', () => {
    test('converts simple object with required fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      });
    });

    test('converts object with optional fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      });
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      });
    });

    test('converts object with default values', () => {
      const schema = z.object({
        name: z.string(),
        count: z.number().default(0),
      });
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'number' },
        },
        required: ['name'],
      });
    });

    test('converts object with all optional fields', () => {
      const schema = z.object({
        name: z.string().optional(),
        age: z.number().optional(),
      });
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      });
      expect(result.required).toBeUndefined();
    });

    test('converts nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number(),
        }),
      });
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
            required: ['name', 'age'],
          },
        },
        required: ['user'],
      });
    });
  });

  describe('Optional and Default', () => {
    test('unwraps ZodOptional', () => {
      const schema = z.string().optional();
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({ type: 'string' });
    });

    test('unwraps ZodDefault', () => {
      const schema = z.string().default('hello');
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({ type: 'string' });
    });

    test('handles optional with default', () => {
      const schema = z.string().optional().default('hello');
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({ type: 'string' });
    });
  });

  describe('Enums', () => {
    test('converts ZodEnum to enum type', () => {
      const schema = z.enum(['red', 'green', 'blue']);
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'string',
        enum: ['red', 'green', 'blue'],
      });
    });
  });

  describe('Unions', () => {
    test('converts union of strings and numbers', () => {
      const schema = z.union([z.string(), z.number()]);
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        anyOf: [{ type: 'string' }, { type: 'number' }],
      });
    });

    test('converts union of multiple types', () => {
      const schema = z.union([z.string(), z.number(), z.boolean()]);
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
      });
    });
  });

  describe('Literals', () => {
    test('converts string literal', () => {
      const schema = z.literal('hello');
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'string',
        const: 'hello',
      });
    });

    test('converts number literal', () => {
      const schema = z.literal(42);
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'number',
        const: 42,
      });
    });

    test('converts boolean literal', () => {
      const schema = z.literal(true);
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'boolean',
        const: true,
      });
    });
  });

  describe('Complex schemas', () => {
    test('handles complex nested schema', () => {
      const schema = z.object({
        id: z.string(),
        name: z.string(),
        tags: z.array(z.string()),
        metadata: z
          .object({
            version: z.number(),
            enabled: z.boolean().optional(),
          })
          .optional(),
        status: z.enum(['active', 'inactive']),
      });
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
          metadata: {
            type: 'object',
            properties: {
              version: { type: 'number' },
              enabled: { type: 'boolean' },
            },
            required: ['version'],
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive'],
          },
        },
        required: ['id', 'name', 'tags', 'status'],
      });
    });

    test('handles array of objects', () => {
      const schema = z.array(
        z.object({
          name: z.string(),
          value: z.number(),
        }),
      );
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'number' },
          },
          required: ['name', 'value'],
        },
      });
    });
  });

  describe('Edge cases', () => {
    test('returns empty object for unknown types', () => {
      // Using a type that's not explicitly handled
      const schema = z.any();
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({});
    });

    test('handles empty object', () => {
      const schema = z.object({});
      const result = zodToJsonSchema(schema);
      expect(result).toEqual({
        type: 'object',
        properties: {},
      });
      expect(result.required).toBeUndefined();
    });
  });
});
