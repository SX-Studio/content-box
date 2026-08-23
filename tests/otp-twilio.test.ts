import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const TWILIO_KEYS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_API_KEY_SID',
  'TWILIO_API_KEY_SECRET',
  'TWILIO_MESSAGING_SERVICE_SID',
  'TWILIO_FROM_NUMBER',
] as const;

function clearTwilioEnv() {
  for (const k of TWILIO_KEYS) delete process.env[k];
}

describe('twilio otp sender', () => {
  beforeEach(() => {
    vi.resetModules();
    clearTwilioEnv();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    clearTwilioEnv();
  });

  it('falls back to the stub (no fetch) when not configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { twilioSender } = await import('@/lib/auth/otp-twilio');
    await twilioSender.send('+32477704740', '123456');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('posts to the Twilio Messages API with API-Key basic auth and a Messaging Service', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_API_KEY_SID = 'SK456';
    process.env.TWILIO_API_KEY_SECRET = 'secret789';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG000';

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 201 }));
    const { twilioSender } = await import('@/lib/auth/otp-twilio');
    await twilioSender.send('+32477704740', '123456');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('SK456:secret789').toString('base64')}`);
    const body = new URLSearchParams(String(init.body));
    expect(body.get('To')).toBe('+32477704740');
    expect(body.get('MessagingServiceSid')).toBe('MG000');
    expect(body.get('From')).toBeNull();
    expect(body.get('Body')).toContain('123456');
  });

  it('uses From when only a from-number is set', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_API_KEY_SID = 'SK456';
    process.env.TWILIO_API_KEY_SECRET = 'secret789';
    process.env.TWILIO_FROM_NUMBER = '+32000000000';

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 201 }));
    const { twilioSender } = await import('@/lib/auth/otp-twilio');
    await twilioSender.send('+32477704740', '654321');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));
    expect(body.get('From')).toBe('+32000000000');
    expect(body.get('MessagingServiceSid')).toBeNull();
  });

  it('throws when Twilio rejects the request', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_API_KEY_SID = 'SK456';
    process.env.TWILIO_API_KEY_SECRET = 'secret789';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG000';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 21211, message: 'Invalid To' }), { status: 400 }),
    );
    const { twilioSender } = await import('@/lib/auth/otp-twilio');
    await expect(twilioSender.send('+bad', '000000')).rejects.toThrow(/Twilio send failed \(400\)/);
  });
});
