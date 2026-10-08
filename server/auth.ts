import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

export const SESSION_COOKIE_NAME = 'school_session';
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const SESSION_ISSUER = 'school-financial-management';

export interface SessionClaims {
  userId: string;
  role: string;
}

export function createSessionToken(
  userId: string,
  role: string,
  secret: string,
  expiresIn: SignOptions['expiresIn'] = SESSION_DURATION_SECONDS,
): string {
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }

  return jwt.sign({ role }, secret, {
    subject: userId,
    issuer: SESSION_ISSUER,
    expiresIn,
  });
}

export function verifySessionToken(token: string, secret: string): SessionClaims | null {
  if (secret.length < 32) return null;

  try {
    const payload = jwt.verify(token, secret, { issuer: SESSION_ISSUER }) as JwtPayload;
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') return null;

    return { userId: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function getSessionTokenFromCookieHeader(cookieHeader = ''): string | null {
  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0 || item.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}