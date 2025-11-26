import { describe, expect, test } from 'bun:test';
import {
  generateTraceId,
  getOrGenerateTraceId,
  getTraceId,
  setTraceIdHeader,
  setTraceIdOnHeaders,
} from './trace-id';

describe('trace-id', () => {
  describe('generateTraceId', () => {
    test('should generate a trace ID with correct format', () => {
      const traceId = generateTraceId();
      expect(traceId).toMatch(/^trace[0-9a-f]{8}$/);
    });

    test('should generate unique trace IDs', () => {
      const traceId1 = generateTraceId();
      const traceId2 = generateTraceId();
      expect(traceId1).not.toBe(traceId2);
    });
  });

  describe('getOrGenerateTraceId', () => {
    test('should return existing trace ID from request headers', () => {
      const existingTraceId = generateTraceId();
      const req = new Request('http://localhost', {
        headers: {
          'X-Trace-Id': existingTraceId,
        },
      });
      const traceId = getOrGenerateTraceId(req);
      expect(traceId).toBe(existingTraceId);
    });

    test('should generate new trace ID when not present in headers', () => {
      const req = new Request('http://localhost');
      const traceId = getOrGenerateTraceId(req);
      expect(traceId).toMatch(/^trace[0-9a-f]{8}$/);
    });
  });

  describe('getTraceId', () => {
    test('should return trace ID from request headers', () => {
      const existingTraceId = generateTraceId();
      const req = new Request('http://localhost', {
        headers: {
          'X-Trace-Id': existingTraceId,
        },
      });
      const traceId = getTraceId(req);
      expect(traceId).toBe(existingTraceId);
    });

    test('should return undefined when trace ID not present', () => {
      const req = new Request('http://localhost');
      const traceId = getTraceId(req);
      expect(traceId).toBeUndefined();
    });
  });

  describe('setTraceIdHeader', () => {
    test('should set trace ID header on response', () => {
      const traceId = generateTraceId();
      const res = new Response('test');
      const newRes = setTraceIdHeader(res, traceId);
      expect(newRes.headers.get('X-Trace-Id')).toBe(traceId);
    });

    test('should preserve existing response properties', () => {
      const traceId = generateTraceId();
      const res = new Response('test body', {
        status: 201,
        statusText: 'Created',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const newRes = setTraceIdHeader(res, traceId);
      expect(newRes.headers.get('X-Trace-Id')).toBe(traceId);
      expect(newRes.headers.get('Content-Type')).toBe('application/json');
      expect(newRes.status).toBe(201);
      expect(newRes.statusText).toBe('Created');
    });
  });

  describe('setTraceIdOnHeaders', () => {
    test('should set trace ID on headers object', () => {
      const traceId = generateTraceId();
      const headers = new Headers();
      setTraceIdOnHeaders(headers, traceId);
      expect(headers.get('X-Trace-Id')).toBe(traceId);
    });

    test('should preserve existing headers', () => {
      const traceId = generateTraceId();
      const headers = new Headers({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
      });
      setTraceIdOnHeaders(headers, traceId);
      expect(headers.get('X-Trace-Id')).toBe(traceId);
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('Authorization')).toBe('Bearer token');
    });
  });
});
