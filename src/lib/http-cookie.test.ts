import { describe, expect, test } from 'bun:test';
import {
  appendCookie,
  deleteCookie,
  getCookie,
  parseCookies,
  serializeCookie,
  setCookie,
  setCookieIfNotExists,
} from './http-cookie';

describe('http-cookie', () => {
  describe('parseCookies', () => {
    test('should parse empty cookie header', () => {
      const cookies = parseCookies('');
      expect(cookies).toEqual({});
    });

    test('should parse single cookie', () => {
      const cookies = parseCookies('session_id=abc123');
      expect(cookies).toEqual({ session_id: 'abc123' });
    });

    test('should parse multiple cookies', () => {
      const cookies = parseCookies('session_id=abc123; user=john; theme=dark');
      expect(cookies).toEqual({
        session_id: 'abc123',
        user: 'john',
        theme: 'dark',
      });
    });

    test('should decode URL-encoded cookie values', () => {
      const cookies = parseCookies('name=John%20Doe');
      expect(cookies).toEqual({ name: 'John Doe' });
    });

    test('should handle cookies with = in value', () => {
      const cookies = parseCookies('token=abc=def=123');
      expect(cookies).toEqual({ token: 'abc=def=123' });
    });
  });

  describe('getCookie', () => {
    test('should get cookie from request', () => {
      const req = new Request('https://example.com', {
        headers: {
          Cookie: 'session_id=abc123; user=john',
        },
      });

      expect(getCookie(req, 'session_id')).toBe('abc123');
      expect(getCookie(req, 'user')).toBe('john');
      expect(getCookie(req, 'nonexistent')).toBeUndefined();
    });

    test('should handle request with no cookies', () => {
      const req = new Request('https://example.com');
      expect(getCookie(req, 'session_id')).toBeUndefined();
    });
  });

  describe('serializeCookie', () => {
    test('should serialize basic cookie', () => {
      const cookie = serializeCookie('session_id', 'abc123');
      expect(cookie).toBe('session_id=abc123');
    });

    test('should serialize cookie with maxAge', () => {
      const cookie = serializeCookie('session_id', 'abc123', { maxAge: 3600 });
      expect(cookie).toBe('session_id=abc123; Max-Age=3600');
    });

    test('should serialize cookie with all options', () => {
      const cookie = serializeCookie('session_id', 'abc123', {
        httpOnly: true,
        secure: true,
        path: '/',
        sameSite: 'Lax',
        maxAge: 3600,
        domain: 'example.com',
      });

      expect(cookie).toContain('session_id=abc123');
      expect(cookie).toContain('Max-Age=3600');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Domain=example.com');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('HttpOnly');
    });

    test('should URL-encode cookie value', () => {
      const cookie = serializeCookie('name', 'John Doe');
      expect(cookie).toBe('name=John%20Doe');
    });

    test('should serialize cookie with expires date', () => {
      const expiresDate = new Date('2025-12-31T23:59:59Z');
      const cookie = serializeCookie('session_id', 'abc123', {
        expires: expiresDate,
      });

      expect(cookie).toContain('session_id=abc123');
      expect(cookie).toContain('Expires=Wed, 31 Dec 2025 23:59:59 GMT');
    });
  });

  describe('setCookie', () => {
    test('should set cookie on response', () => {
      let response = Response.json({ success: true });
      response = setCookie(response, 'session_id', 'abc123', {
        httpOnly: true,
        maxAge: 3600,
      });

      const setCookieHeader = response.headers.get('Set-Cookie');
      expect(setCookieHeader).toContain('session_id=abc123');
      expect(setCookieHeader).toContain('Max-Age=3600');
      expect(setCookieHeader).toContain('HttpOnly');
    });
  });

  describe('setCookieIfNotExists', () => {
    test('should set cookie when it does not exist in request', () => {
      const req = new Request('https://example.com');
      let response = Response.json({ success: true });

      const result = setCookieIfNotExists(req, response, 'session_id', 'abc123', {
        httpOnly: true,
        maxAge: 3600,
      });

      expect(result.value).toBe('abc123');
      expect(result.existed).toBe(false);

      const setCookieHeader = result.response.headers.get('Set-Cookie');
      expect(setCookieHeader).toContain('session_id=abc123');
      expect(setCookieHeader).toContain('Max-Age=3600');
      expect(setCookieHeader).toContain('HttpOnly');
    });

    test('should not set cookie when it already exists in request', () => {
      const req = new Request('https://example.com', {
        headers: {
          Cookie: 'session_id=existing123',
        },
      });
      let response = Response.json({ success: true });

      const result = setCookieIfNotExists(req, response, 'session_id', 'new456', {
        httpOnly: true,
        maxAge: 3600,
      });

      expect(result.value).toBe('existing123');
      expect(result.existed).toBe(true);

      const setCookieHeader = result.response.headers.get('Set-Cookie');
      expect(setCookieHeader).toBeNull();
    });

    test('should return existing value when cookie exists', () => {
      const req = new Request('https://example.com', {
        headers: {
          Cookie: 'user_id=user123; theme=dark',
        },
      });
      let response = Response.json({ success: true });

      const result = setCookieIfNotExists(req, response, 'user_id', 'user456', {
        httpOnly: true,
      });

      expect(result.value).toBe('user123');
      expect(result.existed).toBe(true);
    });
  });

  describe('appendCookie', () => {
    test('should append multiple cookies to response', () => {
      let response = Response.json({ success: true });
      response = appendCookie(response, 'cookie1', 'value1', { httpOnly: true });
      response = appendCookie(response, 'cookie2', 'value2', { httpOnly: true });

      const setCookieHeaders = response.headers.getSetCookie();
      expect(setCookieHeaders).toHaveLength(2);
      expect(setCookieHeaders[0]).toContain('cookie1=value1');
      expect(setCookieHeaders[1]).toContain('cookie2=value2');
    });
  });

  describe('deleteCookie', () => {
    test('should delete cookie by setting maxAge to 0', () => {
      let response = Response.json({ success: true });
      response = deleteCookie(response, 'session_id', { path: '/' });

      const setCookieHeader = response.headers.get('Set-Cookie');
      expect(setCookieHeader).toContain('session_id=');
      expect(setCookieHeader).toContain('Max-Age=0');
      expect(setCookieHeader).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    });
  });
});
