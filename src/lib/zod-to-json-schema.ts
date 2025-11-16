import { z } from 'zod';

/**
 * Convert Zod schema to JSON Schema format.
 * This is a basic implementation that handles common Zod types.
 * For more complex schemas, consider using a library like zod-to-json-schema.
 *
 * @param schema - Zod schema to convert
 * @returns JSON Schema object
 */
export function zodToJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  // Handle basic types
  if (schema instanceof z.ZodString) {
    return { type: 'string' };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  if (schema instanceof z.ZodNull) {
    return { type: 'null' };
  }
  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(schema.element),
    };
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodType<unknown>);
      // Check if field is optional
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    };
  }
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema.unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    return zodToJsonSchema(schema.removeDefault());
  }
  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema.options,
    };
  }
  if (schema instanceof z.ZodUnion) {
    return {
      anyOf: schema.options.map((option: z.ZodTypeAny) =>
        zodToJsonSchema(option as z.ZodType<unknown>),
      ),
    };
  }
  if (schema instanceof z.ZodLiteral) {
    return {
      type:
        typeof schema.value === 'string'
          ? 'string'
          : typeof schema.value === 'number'
            ? 'number'
            : 'boolean',
      const: schema.value,
    };
  }

  // Fallback for unknown types - return a permissive schema
  return {};
}
