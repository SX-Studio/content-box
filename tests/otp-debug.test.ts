import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('OTP_DEBUG_ERRORS switch', () => {
  beforeEach(() => { vi.resetModules(); delete process.env.OTP_DEBUG_ERRORS; });
  afterEach(() => { delete process.env.OTP_DEBUG_ERRORS; });

  it('is OFF when unset — the default must never leak provider state', async () => {
    const { env } = await import('@/lib/env');
    expect(env.otpDebugErrors()).toBe(false);
  });

  it.each(['1', 'true', 'yes', 'TRUE', ' Yes '])('accepts %j as on', async (v) => {
    process.env.OTP_DEBUG_ERRORS = v;
    const { env } = await import('@/lib/env');
    expect(env.otpDebugErrors()).toBe(true);
  });

  it.each(['0', 'false', 'no', '', 'off'])('treats %j as off', async (v) => {
    process.env.OTP_DEBUG_ERRORS = v;
    const { env } = await import('@/lib/env');
    expect(env.otpDebugErrors()).toBe(false);
  });
});
