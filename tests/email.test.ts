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

describe('Resend error detail', () => {
  beforeEach(() => { vi.resetModules(); clear(); });
  afterEach(() => { vi.restoreAllMocks(); clear(); });

  function configure() {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'Content Box <no-reply@content24market.space>';
  }

  it('surfaces the unverified-domain rejection verbatim (the common setup failure)', async () => {
    configure();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 403,
          name: 'validation_error',
          message: 'The content24market.space domain is not verified. Please, add and verify your domain on https://resend.com/domains',
        }),
        { status: 403 },
      ),
    );
    const { sendEmailChecked } = await import('@/lib/email');
    const r = await sendEmailChecked('a@b.com', 's', 'b');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(403);
    expect(r.detail).toContain('validation_error');
    expect(r.detail).toContain('domain is not verified');
  });

  it('understands a nested { error: { name, message } } body', async () => {
    configure();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { name: 'missing_api_key', message: 'Missing API key' } }), { status: 401 }),
    );
    const { sendEmailChecked } = await import('@/lib/email');
    const r = await sendEmailChecked('a@b.com', 's', 'b');
    expect(r).toEqual({ ok: false, status: 401, detail: 'missing_api_key Missing API key' });
  });

  it('still reports cleanly on a non-JSON error body', async () => {
    configure();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>gateway</html>', { status: 502 }));
    const { sendEmailChecked } = await import('@/lib/email');
    expect(await sendEmailChecked('a@b.com', 's', 'b')).toEqual({ ok: false, status: 502, detail: '' });
  });

  it('reports a network failure without throwing', async () => {
    configure();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    const { sendEmailChecked } = await import('@/lib/email');
    expect(await sendEmailChecked('a@b.com', 's', 'b')).toEqual({ ok: false, status: 0, detail: 'network error' });
  });

  it('makes no call and stays quiet when unconfigured', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { sendEmail } = await import('@/lib/email');
    expect(await sendEmail('a@b.com', 's', 'b')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled(); // "not configured" is not an error worth logging
  });

  it('never puts the recipient or the body in the log line', async () => {
    configure();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ name: 'validation_error', message: 'domain not verified' }), { status: 403 }),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendEmail } = await import('@/lib/email');
    await sendEmail('jane.doe@example.com', 'Subject', 'secret body 123456');
    const logged = warn.mock.calls.flat().join(' ');
    expect(logged).toContain('403');
    expect(logged).toContain('validation_error');
    expect(logged).not.toContain('jane.doe@example.com');
    expect(logged).not.toContain('123456');
  });
});

describe('sendEmailOtp surfaces the reason', () => {
  beforeEach(() => { vi.resetModules(); clear(); });
  afterEach(() => { vi.restoreAllMocks(); clear(); });

  it('throws with Resend status and code so [otp/start] names the fix', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'x@y.com';
    process.env.OTP_SENDER = 'bird';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ name: 'validation_error', message: 'The y.com domain is not verified.' }), { status: 403 }),
    );
    const { sendEmailOtp } = await import('@/lib/auth/otp-email');
    await expect(sendEmailOtp('a@b.com', '123456')).rejects.toThrow(
      /Email send failed \(403\): validation_error The y\.com domain is not verified\./,
    );
    delete process.env.OTP_SENDER;
  });

  it('does not leak the code or address into the thrown message', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'x@y.com';
    process.env.OTP_SENDER = 'bird';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }));
    const { sendEmailOtp } = await import('@/lib/auth/otp-email');
    const err = await sendEmailOtp('jane@example.com', '987654').catch((e: Error) => e);
    expect(String(err)).not.toContain('987654');
    expect(String(err)).not.toContain('jane@example.com');
    delete process.env.OTP_SENDER;
  });
});
