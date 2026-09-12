import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEYS = [
  'OTP_SENDER',
  'BIRD_API_KEY', 'BIRD_REGION', 'BIRD_FROM',
  'TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_MESSAGING_SERVICE_SID', 'TWILIO_FROM_NUMBER',
] as const;
const clear = () => KEYS.forEach((k) => delete process.env[k]);

function configureBird() {
  process.env.OTP_SENDER = 'bird';
  process.env.BIRD_API_KEY = 'bk_eu1_testkey';
  process.env.BIRD_FROM = 'ContentBox';
}

describe('sendSms provider dispatch', () => {
  beforeEach(() => { vi.resetModules(); clear(); });
  afterEach(() => { vi.restoreAllMocks(); clear(); });

  it('with OTP_SENDER=bird, routes notification SMS through Bird as a transactional message', async () => {
    configureBird();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 202 }));
    const { sendSms, smsConfigured } = await import('@/lib/sms');
    expect(smsConfigured()).toBe(true);
    expect(await sendSms('+32477704740', 'Payout paid')).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://eu1.platform.bird.com/v1/sms/messages');
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    expect(body.to).toBe('+32477704740');
    expect(body.text).toBe('Payout paid');
    expect(body.category).toBe('transactional');
  });

  it('with OTP_SENDER=bird but Bird unconfigured, reports unconfigured and sends nothing', async () => {
    process.env.OTP_SENDER = 'bird';
    // Twilio vars present must NOT be used as a silent fallback for notifications.
    process.env.TWILIO_ACCOUNT_SID = 'AC1';
    process.env.TWILIO_API_KEY_SID = 'SK1';
    process.env.TWILIO_API_KEY_SECRET = 'sec';
    process.env.TWILIO_FROM_NUMBER = '+32000000000';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { sendSms, smsConfigured } = await import('@/lib/sms');
    expect(smsConfigured()).toBe(false);
    expect(await sendSms('+32477704740', 'hi')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('with OTP_SENDER=bird, returns false (no throw) when Bird rejects', async () => {
    configureBird();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"code":"x"}', { status: 400 }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendSms } = await import('@/lib/sms');
    expect(await sendSms('+32477704740', 'x')).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('without OTP_SENDER=bird, the original Twilio path is unchanged (regression guard)', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC1';
    process.env.TWILIO_API_KEY_SID = 'SK1';
    process.env.TWILIO_API_KEY_SECRET = 'sec';
    process.env.TWILIO_FROM_NUMBER = '+32000000000';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }));
    const { sendSms, smsConfigured } = await import('@/lib/sms');
    expect(smsConfigured()).toBe(true);
    expect(await sendSms('+32477704740', 'Payout paid')).toBe(true);
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json');
  });
});
