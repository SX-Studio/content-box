import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_MESSAGING_SERVICE_SID', 'TWILIO_FROM_NUMBER'] as const;
const clear = () => KEYS.forEach((k) => delete process.env[k]);

describe('sendSms', () => {
  beforeEach(() => { vi.resetModules(); clear(); });
  afterEach(() => { vi.restoreAllMocks(); clear(); });

  it('returns false and makes no call when unconfigured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { sendSms, smsConfigured } = await import('@/lib/sms');
    expect(smsConfigured()).toBe(false);
    expect(await sendSms('+32477704740', 'hi')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to Twilio and returns true on success', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC1';
    process.env.TWILIO_API_KEY_SID = 'SK1';
    process.env.TWILIO_API_KEY_SECRET = 'sec';
    process.env.TWILIO_FROM_NUMBER = '+32000000000';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }));
    const { sendSms } = await import('@/lib/sms');
    expect(await sendSms('+32477704740', 'Payout paid')).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json');
    const body = new URLSearchParams(String(init.body));
    expect(body.get('To')).toBe('+32477704740');
    expect(body.get('From')).toBe('+32000000000');
    expect(body.get('Body')).toBe('Payout paid');
  });

  it('returns false (no throw) when Twilio rejects', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC1';
    process.env.TWILIO_API_KEY_SID = 'SK1';
    process.env.TWILIO_API_KEY_SECRET = 'sec';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG1';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad', { status: 400 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendSms } = await import('@/lib/sms');
    expect(await sendSms('+32477704740', 'x')).toBe(false);
  });
});
