import { SessionId } from './session-id';
import { getCookie, setCookie, setCookieIfNotExists, type CookieOptions } from './http-cookie';

const SESSION_COOKIE_NAME = 'session_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  sameSite: 'Lax',
  maxAge: COOKIE_MAX_AGE,
};

/**
 * Get session ID from request cookies, or generate a new one
 */
export function getSessionId(req: Request): SessionId {
  const sessionId = getCookie(req, SESSION_COOKIE_NAME);

  if (sessionId && SessionId.schema.safeParse(sessionId).success) {
    return sessionId as SessionId;
  }

  return SessionId.generate();
}

/**
 * Set session ID cookie on response
 */
export function setSessionCookie(req: Request, response: Response, sessionId: SessionId): Response {
  const result = setCookieIfNotExists(
    req,
    response,
    SESSION_COOKIE_NAME,
    sessionId,
    SESSION_COOKIE_OPTIONS,
  );
  return result.response;
}
