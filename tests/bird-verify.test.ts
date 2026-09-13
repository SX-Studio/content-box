import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEYS = ['BIRD_API_KEY', 'BIRD_REGION', 'OTP_SENDER'] as const;
const clear = () => KEYS.forEach((k) => delete process.env[k]);
const configure = (region?: string) => {
  process.env.BIRD_API_KEY = 'bk_eu1_testkey';
  if (region) process.env.BIRD_REGION = region;
};

describe('bird verify transport', () => {
  beforeEach(() => { vi.resetModules(); clear(); });
  afterEach(() => { vi.restoreAllMocks(); clear(); });

  it('starts a verification at the documented EU endpoint with a phone target', async () => {
    configure();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'vrf_abc', status: 'pending' }), { status: 200 }),
    );
    const { birdVerifyStart } = await import('@/lib/bird-verify');
    const r = await birdVerifyStart({ phone_number: '+32477704740' });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://eu1.platform.bird.com/v1/verify/verifications');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer bk_eu1_testkey');
    expect(JSON.parse(String(init.body))).toEqual({ to: { phone_number: '+32477704740' } });
    expect(r).toEqual({ ok: true, id: 'vrf_abc', status: 'pending' });
  });

  it('honours BIRD_REGION=us1 and needs no BIRD_FROM', async () => {
    configure('us1');
    delete process.env.BIRD_FROM;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'vrf_1', status: 'pending' }), { status: 200 }),
    );
    const { birdVerifyStart } = await import('@/lib/bird-verify');
    const r = await birdVerifyStart({ phone_number: '+15551234567' });
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://us1.platform.bird.com/v1/verify/verifications');
    expect(r.ok).toBe(true);
  });

  it('checks a code at /check and reports success', async () => {
    configure();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, reason: null, attempts_remaining: 5 }), { status: 200 }),
    );
    const { birdVerifyCheck } = await import('@/lib/bird-verify');
    const r = await birdVerifyCheck({ phone_number: '+32477704740' }, '123456');

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://eu1.platform.bird.com/v1/verify/verifications/check');
    expect(JSON.parse(String(init.body))).toEqual({ to: { phone_number: '+32477704740' }, code: '123456' });
    expect(r).toEqual({ ok: true, success: true, reason: null, attemptsRemaining: 5 });
  });

  it('reports an incorrect code as a successful call with success:false', async () => {
    // A wrong code is a 200 from Bird, not an error — conflating the two would turn a
    // mistyped digit into a 500.
    configure();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, reason: 'incorrect_code', attempts_remaining: 4 }), { status: 200 }),
    );
    const { birdVerifyCheck } = await import('@/lib/bird-verify');
    expect(await birdVerifyCheck({ phone_number: '+32477704740' }, '000000'))
      .toEqual({ ok: true, success: false, reason: 'incorrect_code', attemptsRemaining: 4 });
  });

  it('accepts an email target shape', async () => {
    configure();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'vrf_e', status: 'pending' }), { status: 200 }),
    );
    const { birdVerifyStart } = await import('@/lib/bird-verify');
    await birdVerifyStart({ email: 'a@b.com' });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ to: { email: 'a@b.com' } });
  });

  it('surfaces a rejection with status and detail', async () => {
    configure();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'invalid_recipient', message: 'bad number' }), { status: 400 }),
    );
    const { birdVerifyStart } = await import('@/lib/bird-verify');
    expect(await birdVerifyStart({ phone_number: '+bad' }))
      .toEqual({ ok: false, status: 400, detail: 'invalid_recipient bad number' });
  });

  it('makes no call when unconfigured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { birdVerifyStart } = await import('@/lib/bird-verify');
    expect(await birdVerifyStart({ phone_number: '+32477704740' }))
      .toEqual({ ok: false, status: 0, detail: 'not configured' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('treats an unknown region as not configured rather than guessing a host', async () => {
    configure('mars1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { birdVerifyStart } = await import('@/lib/bird-verify');
    expect((await birdVerifyStart({ phone_number: '+32477704740' })).ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('verify mode selection', () => {
  beforeEach(() => { vi.resetModules(); clear(); });
  afterEach(() => { clear(); });

  it('is off unless OTP_SENDER=bird-verify', async () => {
    configure();
    process.env.OTP_SENDER = 'bird';
    const { birdVerifyMode } = await import('@/lib/auth/verify-mode');
    expect(birdVerifyMode('sms')).toBe(false);
  });

  it('is on for SMS when selected and configured', async () => {
    configure();
    process.env.OTP_SENDER = 'bird-verify';
    const { birdVerifyMode } = await import('@/lib/auth/verify-mode');
    expect(birdVerifyMode('sms')).toBe(true);
  });

  it('never takes over EMAIL — that stays on Resend', async () => {
    configure();
    process.env.OTP_SENDER = 'bird-verify';
    const { birdVerifyMode } = await import('@/lib/auth/verify-mode');
    expect(birdVerifyMode('email')).toBe(false);
  });

  it('falls back off when the key is missing, rather than half-enabling', async () => {
    process.env.OTP_SENDER = 'bird-verify';
    const { birdVerifyMode } = await import('@/lib/auth/verify-mode');
    expect(birdVerifyMode('sms')).toBe(false);
  });

  it('maps identifiers to the documented target shapes', async () => {
    const { toVerifyTarget } = await import('@/lib/auth/verify-mode');
    expect(toVerifyTarget({ channel: 'sms', identifier: '+32477704740', hash: 'h' }))
      .toEqual({ phone_number: '+32477704740' });
    expect(toVerifyTarget({ channel: 'email', identifier: 'a@b.com', hash: 'h' }))
      .toEqual({ email: 'a@b.com' });
  });
});
