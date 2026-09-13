import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEYS = ['OTP_SENDER', 'BIRD_API_KEY', 'BIRD_REGION', 'BIRD_FROM', 'APP_ORIGIN'] as const;
const clear = () => KEYS.forEach((k) => delete process.env[k]);
const bird = () => {
  process.env.BIRD_API_KEY = 'bk_eu1_testkey';
  process.env.BIRD_FROM = 'ContentBox';
};

describe('notification SMS routing', () => {
  beforeEach(() => { vi.resetModules(); clear(); });
  afterEach(() => { vi.restoreAllMocks(); clear(); });

  it('routes over Bird under OTP_SENDER=bird-verify', async () => {
    // Regression: Verify only sends OTP codes, so arbitrary notification text must
    // still take the plain SMS path. This previously fell through to the unconfigured
    // Twilio branch and returned false, silently dropping every invite and payout text.
    bird();
    process.env.OTP_SENDER = 'bird-verify';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 202 }));
    const { sendSms, smsConfigured } = await import('@/lib/sms');
    expect(smsConfigured()).toBe(true);
    expect(await sendSms('+32477704740', 'hello')).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://eu1.platform.bird.com/v1/sms/messages');
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    expect(body.text).toBe('hello');
    expect(body.category).toBe('transactional');
  });

  it('still routes over Bird under OTP_SENDER=bird (unchanged)', async () => {
    bird();
    process.env.OTP_SENDER = 'bird';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 202 }));
    const { sendSms } = await import('@/lib/sms');
    await sendSms('+32477704740', 'hello');
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('platform.bird.com');
  });

  it('leaves the Twilio path alone for every other value (regression guard)', async () => {
    process.env.OTP_SENDER = 'twilio';
    const { sendSms } = await import('@/lib/sms');
    // Twilio vars unset → false without reaching Bird.
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await sendSms('+32477704740', 'hello')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('carries the message body verbatim — an invite link must not be reworded', async () => {
    // The invite used to go through OtpSender.send(phone, code), which wraps its second
    // argument in "Your Content Box code is …. Do not share it." — turning an invite
    // link into a garbled code message that told the invitee not to share it.
    bird();
    process.env.OTP_SENDER = 'bird-verify';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 202 }));
    const { sendSms } = await import('@/lib/sms');
    const msg = 'You have been invited to a box on Content Box: https://content24market.space/invite/abc';
    await sendSms('+32477704740', msg);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    expect(body.text).toBe(msg);
    expect(body.text).not.toContain('code is');
    expect(body.text).not.toContain('Do not share');
  });
});

describe('invite link shape', () => {
  beforeEach(() => { vi.resetModules(); clear(); });
  afterEach(() => { clear(); });

  it('appOrigin gives an absolute base — a bare /invite/<token> is useless in an SMS', async () => {
    process.env.APP_ORIGIN = 'https://content24market.space';
    const { env } = await import('@/lib/env');
    const link = `${env.appOrigin()}/invite/tok123`;
    expect(link).toBe('https://content24market.space/invite/tok123');
    expect(link.startsWith('https://')).toBe(true);
  });
});
