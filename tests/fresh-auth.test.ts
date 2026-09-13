import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('fresh-auth token', () => {
  beforeEach(() => { vi.resetModules(); process.env.SESSION_SECRET = 'test-session-secret'; });

  it('verifies for the account it was minted for', async () => {
    const { signFreshAuth, verifyFreshAuth } = await import('@/lib/fresh-auth');
    expect(verifyFreshAuth(signFreshAuth('acc-1'), 'acc-1')).toBe(true);
  });

  it('does not verify for a different account', async () => {
    const { signFreshAuth, verifyFreshAuth } = await import('@/lib/fresh-auth');
    expect(verifyFreshAuth(signFreshAuth('acc-1'), 'acc-2')).toBe(false);
  });

  it('expires', async () => {
    const { signFreshAuth, verifyFreshAuth } = await import('@/lib/fresh-auth');
    expect(verifyFreshAuth(signFreshAuth('acc-1', -10), 'acc-1')).toBe(false);
  });

  it.each(['', 'not-a-token', 'no-dot', undefined, null])('rejects garbage %j', async (bad) => {
    const { verifyFreshAuth } = await import('@/lib/fresh-auth');
    expect(verifyFreshAuth(bad as string | null, 'acc-1')).toBe(false);
  });

  it('a SESSION token cannot be replayed as fresh-auth', async () => {
    const { verifyFreshAuth } = await import('@/lib/fresh-auth');
    const { signSession } = await import('@/lib/session');
    expect(verifyFreshAuth(signSession('acc-1'), 'acc-1')).toBe(false);
  });

  it('an ADMIN STEP-UP token cannot be replayed as fresh-auth, and vice versa', async () => {
    // The whole reason this is a separate family: the step-up cookie is the admin
    // fingerprint proof, and an OTP sign-in must never satisfy it.
    const { verifyFreshAuth, signFreshAuth } = await import('@/lib/fresh-auth');
    const { signStepUp, verifyStepUp } = await import('@/lib/stepup');
    expect(verifyFreshAuth(signStepUp('acc-1'), 'acc-1')).toBe(false);
    expect(verifyStepUp(signFreshAuth('acc-1'), 'acc-1')).toBe(false);
  });

  it('uses a different cookie name than the step-up', async () => {
    const { FRESH_AUTH_COOKIE } = await import('@/lib/fresh-auth');
    const { STEPUP_COOKIE } = await import('@/lib/stepup');
    const { SESSION_COOKIE } = await import('@/lib/session');
    expect(new Set([FRESH_AUTH_COOKIE, STEPUP_COOKIE, SESSION_COOKIE]).size).toBe(3);
  });
});
