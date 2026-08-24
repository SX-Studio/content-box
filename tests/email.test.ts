import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEYS = ['RESEND_API_KEY', 'EMAIL_FROM'] as const;
const clear = () => KEYS.forEach((k) => delete process.env[k]);

describe('sendEmail', () => {
  beforeEach(() => { vi.resetModules(); clear(); });
  afterEach(() => { vi.restoreAllMocks(); clear(); });

  it('returns false and makes no call when unconfigured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { sendEmail, emailConfigured } = await import('@/lib/email');
    expect(emailConfigured()).toBe(false);
    expect(await sendEmail('a@b.com', 'Hi', 'body')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to Resend with bearer auth and returns true on success', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'Content Box <no-reply@x.com>';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const { sendEmail } = await import('@/lib/email');
    expect(await sendEmail('a@b.com', 'Subject', 'body')).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ from: 'Content Box <no-reply@x.com>', to: 'a@b.com', subject: 'Subject', text: 'body' });
  });

  it('returns false (no throw) when Resend rejects', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'x@y.com';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad', { status: 422 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendEmail } = await import('@/lib/email');
    expect(await sendEmail('a@b.com', 's', 'b')).toBe(false);
  });
});
