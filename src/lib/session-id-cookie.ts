import { getCookie, setCookie, type CookieOptions } from './http-cookie';
import { SessionId } from './session-id';

const SESSION_COOKIE_NAME = 'session_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Most secure possible cookie settings for single-origin app
const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true, // Prevent JS access
  secure: true, // Always require HTTPS
  path: '/', // Whole origin
  sameSite: 'Strict', // Never send cross-origin
  maxAge: COOKIE_MAX_AGE,
  // No domain: restricts to current host
};

/**
 * Get session ID from request cookies, or generate a new one
 * Will ONLY accept session ids that strictly pass schema validation
 */
export function getSessionId(req: Request): SessionId {
  const sessionId = getCookie(req, SESSION_COOKIE_NAME);

  if (typeof sessionId === 'string' && SessionId.schema.safeParse(sessionId).success) {
    return sessionId as SessionId;
  }

  return SessionId.generate();
}

/**
 * Set session ID cookie on response with maximum security
 */
export function setSessionCookie(req: Request, response: Response, sessionId: SessionId): Response {
  // Always overwrite - do not allow fixation via not-set
  const result = setCookie(response, SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
  return result;
}
