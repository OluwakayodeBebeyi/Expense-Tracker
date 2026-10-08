import { describe, expect, it } from 'vitest';
import { createSessionToken, getSessionTokenFromCookieHeader, verifySessionToken } from './auth.js';

const secret = 'test-only-signing-secret-with-at-least-32-characters';

describe('authentication sessions', () => {
  it('signs a session with a subject and role', () => {
    const token = createSessionToken('user-123', 'Administrator', secret);

    expect(verifySessionToken(token, secret)).toEqual({
      userId: 'user-123',
      role: 'Administrator',
    });
  });

  it('rejects tokens signed with another secret', () => {
    const token = createSessionToken('user-123', 'Administrator', secret);

    expect(verifySessionToken(token, 'different-signing-secret-with-at-least-32-chars')).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifySessionToken('not-a-token', secret)).toBeNull();
  });

  it('rejects expired sessions', () => {
    const token = createSessionToken('user-123', 'Administrator', secret, -1);

    expect(verifySessionToken(token, secret)).toBeNull();
  });

  it('reads the session from a cookie header without accepting another cookie', () => {
    expect(getSessionTokenFromCookieHeader('theme=dark; school_session=abc.def;')).toBe('abc.def');
    expect(getSessionTokenFromCookieHeader('theme=dark')).toBeNull();
  });
});