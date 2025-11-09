/**
 * Generic HTTP cookie utilities for parsing and serializing cookies
 */

export interface CookieOptions {
  /** Forbids JavaScript from accessing the cookie */
  httpOnly?: boolean;
  /** Cookie is only sent over HTTPS */
  secure?: boolean;
  /** URL path that must exist in the requested URL */
  path?: string;
  /** Controls whether cookie is sent with cross-site requests */
  sameSite?: 'Strict' | 'Lax' | 'None';
  /** Maximum age in seconds */
  maxAge?: number;
  /** Domain where the cookie is available */
  domain?: string;
  /** Expiration date */
  expires?: Date;
}

/**
 * Parse cookies from a Cookie header string
 * @param cookieHeader - The Cookie header value from a request
 * @returns Object mapping cookie names to values
 *
 * @example
 * const cookies = parseCookies(req.headers.get('Cookie'));
 * const sessionId = cookies['session_id'];
 */
export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=').trim();
    if (name && value) {
      try {
        cookies[name.trim()] = decodeURIComponent(value);
      } catch {
        // If decode fails, use raw value
        cookies[name.trim()] = value;
      }
    }
  });

  return cookies;
}

/**
 * Get a specific cookie value from a request
 * @param req - The Request object
 * @param name - The cookie name
 * @returns The cookie value or undefined if not found
 *
 * @example
 * const sessionId = getCookie(req, 'session_id');
 */
export function getCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  return cookies[name];
}

/**
 * Serialize a cookie name and value into a Set-Cookie header string
 * @param name - The cookie name
 * @param value - The cookie value
 * @param options - Cookie options
 * @returns A Set-Cookie header value
 *
 * @example
 * const cookieString = serializeCookie('session_id', 'abc123', {
 *   httpOnly: true,
 *   secure: true,
 *   maxAge: 86400
 * });
 */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  let cookie = `${name}=${encodeURIComponent(value)}`;

  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${options.maxAge}`;
  }

  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }

  if (options.path) {
    cookie += `; Path=${options.path}`;
  }

  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }

  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  }

  if (options.secure) {
    cookie += '; Secure';
  }

  if (options.httpOnly) {
    cookie += '; HttpOnly';
  }

  return cookie;
}

/**
 * Set a cookie on a response
 * @param response - The Response object
 * @param name - The cookie name
 * @param value - The cookie value
 * @param options - Cookie options
 * @returns The Response object with cookie set
 *
 * @example
 * let response = Response.json({ success: true });
 * response = setCookie(response, 'session_id', 'abc123', {
 *   httpOnly: true,
 *   secure: true,
 *   maxAge: 86400
 * });
 */
export function setCookie(
  response: Response,
  name: string,
  value: string,
  options: CookieOptions = {},
): Response {
  const cookieValue = serializeCookie(name, value, options);
  response.headers.set('Set-Cookie', cookieValue);
  return response;
}

/**
 * Set a cookie on a response only if it doesn't exist in the request
 * @param req - The Request object to check for existing cookie
 * @param response - The Response object
 * @param name - The cookie name
 * @param value - The cookie value
 * @param options - Cookie options
 * @returns Object with the Response and the cookie value (existing or new)
 *
 * @example
 * const req = new Request('https://example.com');
 * let response = Response.json({ success: true });
 * const { response: res, value } = setCookieIfNotExists(req, response, 'session_id', 'abc123', {
 *   httpOnly: true,
 *   maxAge: 86400
 * });
 */
export function setCookieIfNotExists(
  req: Request,
  response: Response,
  name: string,
  value: string,
  options: CookieOptions = {},
): { response: Response; value: string; existed: boolean } {
  const existingValue = getCookie(req, name);

  if (existingValue) {
    return { response, value: existingValue, existed: true };
  }

  const updatedResponse = setCookie(response, name, value, options);
  return { response: updatedResponse, value, existed: false };
}

/**
 * Append a cookie to a response (useful for setting multiple cookies)
 * @param response - The Response object
 * @param name - The cookie name
 * @param value - The cookie value
 * @param options - Cookie options
 * @returns The Response object with cookie appended
 *
 * @example
 * let response = Response.json({ success: true });
 * response = appendCookie(response, 'cookie1', 'value1', { httpOnly: true });
 * response = appendCookie(response, 'cookie2', 'value2', { httpOnly: true });
 */
export function appendCookie(
  response: Response,
  name: string,
  value: string,
  options: CookieOptions = {},
): Response {
  const cookieValue = serializeCookie(name, value, options);
  response.headers.append('Set-Cookie', cookieValue);
  return response;
}

/**
 * Delete a cookie by setting it to expire immediately
 * @param response - The Response object
 * @param name - The cookie name
 * @param options - Cookie options (path and domain should match the original cookie)
 * @returns The Response object with delete cookie header set
 *
 * @example
 * let response = Response.json({ success: true });
 * response = deleteCookie(response, 'session_id', { path: '/' });
 */
export function deleteCookie(
  response: Response,
  name: string,
  options: Pick<CookieOptions, 'path' | 'domain'> = {},
): Response {
  const cookieValue = serializeCookie(name, '', {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  });
  response.headers.set('Set-Cookie', cookieValue);
  return response;
}
