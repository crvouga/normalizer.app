# HTTP Cookie Utilities

A reusable, type-safe HTTP cookie handling module for working with cookies in standard Fetch API `Request` and `Response` objects.

## Features

- ✅ Parse cookies from request headers
- ✅ Serialize cookies for response headers
- ✅ Type-safe cookie options
- ✅ URL encoding/decoding
- ✅ Multiple cookie support
- ✅ Cookie deletion
- ✅ Framework-agnostic (works with any Fetch API)

## API

### `parseCookies(cookieHeader: string): Record<string, string>`

Parse a `Cookie` header string into an object.

```typescript
const cookies = parseCookies('session_id=abc123; theme=dark');
// { session_id: 'abc123', theme: 'dark' }
```

### `getCookie(req: Request, name: string): string | undefined`

Get a specific cookie value from a request.

```typescript
const sessionId = getCookie(req, 'session_id');
```

### `serializeCookie(name: string, value: string, options?: CookieOptions): string`

Serialize a cookie into a `Set-Cookie` header string.

```typescript
const cookieString = serializeCookie('session_id', 'abc123', {
  httpOnly: true,
  secure: true,
  maxAge: 86400,
  path: '/',
  sameSite: 'Lax',
});
// 'session_id=abc123; Max-Age=86400; Path=/; SameSite=Lax; Secure; HttpOnly'
```

### `setCookie(response: Response, name: string, value: string, options?: CookieOptions): Response`

Set a cookie on a response (replaces existing Set-Cookie header).

```typescript
let response = Response.json({ success: true });
response = setCookie(response, 'session_id', 'abc123', {
  httpOnly: true,
  secure: true,
  maxAge: 86400,
});
```

### `setCookieIfNotExists(req: Request, response: Response, name: string, value: string, options?: CookieOptions): { response: Response; value: string; existed: boolean }`

Set a cookie on a response only if it doesn't already exist in the request. Returns the response and the cookie value (either existing or newly set).

```typescript
const req = new Request('https://example.com');
let response = Response.json({ success: true });

const {
  response: res,
  value,
  existed,
} = setCookieIfNotExists(req, response, 'session_id', 'abc123', {
  httpOnly: true,
  maxAge: 86400,
});

console.log(value); // 'abc123' (or existing value if cookie already exists)
console.log(existed); // false (or true if cookie already existed)
```

### `appendCookie(response: Response, name: string, value: string, options?: CookieOptions): Response`

Append a cookie to a response (allows multiple Set-Cookie headers).

```typescript
let response = Response.json({ success: true });
response = appendCookie(response, 'cookie1', 'value1', { httpOnly: true });
response = appendCookie(response, 'cookie2', 'value2', { httpOnly: true });
```

### `deleteCookie(response: Response, name: string, options?: Pick<CookieOptions, 'path' | 'domain'>): Response`

Delete a cookie by setting it to expire immediately.

```typescript
let response = Response.json({ success: true });
response = deleteCookie(response, 'session_id', { path: '/' });
```

## Cookie Options

```typescript
interface CookieOptions {
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
```

## Examples

### Basic Session Cookie

```typescript
import { getCookie, setCookie } from './lib/http-cookie';

// In a route handler
const handler = async (req: Request) => {
  // Read session cookie
  const sessionId = getCookie(req, 'session_id') || generateNewSessionId();

  // Process request
  const data = await processRequest(sessionId);

  // Set session cookie on response
  let response = Response.json(data);
  response = setCookie(response, 'session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return response;
};
```

### Session Cookie with Conditional Setting

```typescript
import { setCookieIfNotExists } from './lib/http-cookie';

// Cleaner approach - only set cookie if it doesn't exist
const handler = async (req: Request) => {
  let response = Response.json({ success: true });

  // Set session cookie only if user doesn't have one
  const { response: res, value: sessionId } = setCookieIfNotExists(
    req,
    response,
    'session_id',
    generateNewSessionId(), // Only called if cookie doesn't exist
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    },
  );

  // Use sessionId for request processing
  const data = await processRequest(sessionId);

  return res;
};
```

### Multiple Cookies

```typescript
let response = Response.json({ success: true });
response = appendCookie(response, 'user_id', 'user123', { httpOnly: true });
response = appendCookie(response, 'theme', 'dark', { maxAge: 86400 });
response = appendCookie(response, 'language', 'en', { maxAge: 86400 });
```

### Authentication Flow

```typescript
// Login
export const login = async (req: Request) => {
  const credentials = await req.json();
  const user = await authenticateUser(credentials);

  let response = Response.json({ user });
  response = setCookie(response, 'auth_token', user.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
};

// Logout
export const logout = async (req: Request) => {
  let response = Response.json({ success: true });
  response = deleteCookie(response, 'auth_token', { path: '/' });
  return response;
};

// Protected route
export const protectedRoute = async (req: Request) => {
  const token = getCookie(req, 'auth_token');

  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await validateToken(token);
  return Response.json({ user });
};
```

## Testing

Run tests with:

```bash
bun test src/lib/http-cookie.test.ts
```

## Related

- `session-id-cookie.ts` - Session-specific cookie utilities built on top of this module
