import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEYS = ['OTP_SENDER', 'BIRD_API_KEY', 'BIRD_REGION', 'BIRD_FROM', 'APP_ORIGIN'] as const;
const clear = () => KEYS.forEach((k) => delete process.env[k]);
const bird = () => {
  process.env.BIRD_API_KEY = 'bk_eu1_testkey';
  process.env.BIRD_FROM = 'ContentBox';
  process.env.OTP_SENDER = 'bird';
};

describe('sendSmsChecked surfaces the provider reason', () => {
  beforeEach(() => { vi.resetModules(); clear(); });
  afterEach(() => { vi.restoreAllMocks(); clear(); });

  it("carries Bird's code and message out to the caller", async () => {
    // The whole point: a boolean false told nobody why invite delivery failed, while
    // birdPost had already parsed Bird's { code, message } envelope and dropped it.
    bird();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'E02035', message: 'requires the "sms:write" scope' }), { status: 403 }),
    );
    const { sendSmsChecked } = await import('@/lib/sms');
    const r = await sendSmsChecked('+32477704740', 'hello');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.status).toBe(403);
    expect(r.detail).toContain('E02035');
    expect(r.detail).toContain('sms:write');
  });

  it('never leaks the recipient, the body or the API key into the reason', async () => {
    bird();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'E1', message: 'nope' }), { status: 400 }),
    );
    const { sendSmsChecked } = await import('@/lib/sms');
    const r = await sendSmsChecked('+32477704740', 'join this box: https://x/invite/secrettoken');
    if (r.ok) throw new Error('unreachable');
    expect(r.detail).not.toContain('+32477704740');
    expect(r.detail).not.toContain('secrettoken');
    expect(r.detail).not.toContain('bk_eu1_testkey');
  });

  it('keeps the boolean sendSms contract for fire-and-forget callers', async () => {
    // payouts.ts and identity.ts still treat SMS as best-effort; they must not start
    // throwing or receiving an object.
    bird();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 202 }));
    const { sendSms } = await import('@/lib/sms');
    expect(await sendSms('+32477704740', 'hello')).toBe(true);
  });

  it('reports unconfigured Twilio as a reason rather than a bare false', async () => {
    process.env.OTP_SENDER = 'twilio';
    const { sendSmsChecked } = await import('@/lib/sms');
    const r = await sendSmsChecked('+32477704740', 'hello');
    if (r.ok) throw new Error('unreachable');
    expect(r.detail).toMatch(/not configured/i);
  });
});
