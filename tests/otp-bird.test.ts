import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const BIRD_KEYS = ['BIRD_API_KEY', 'BIRD_REGION', 'BIRD_FROM', 'BIRD_TEMPLATE_SLUG', 'BIRD_TEMPLATE_LANGUAGE'] as const;

function clearBirdEnv() {
  for (const k of BIRD_KEYS) delete process.env[k];
}

function configure(region?: string) {
  process.env.BIRD_API_KEY = 'bk_eu1_testkey';
  process.env.BIRD_FROM = 'ContentBox';
  if (region) process.env.BIRD_REGION = region;
}

describe('bird otp sender', () => {
  beforeEach(() => {
    vi.resetModules();
    clearBirdEnv();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    clearBirdEnv();
  });

  it('falls back to the stub (no fetch) when not configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { birdSender } = await import('@/lib/auth/otp-bird');
    await birdSender.send('+32477704740', '123456');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(log).toHaveBeenCalled(); // the stub logged the code
  });

  it('treats an unknown region as not configured (stub, no fetch) rather than guessing', async () => {
    configure('mars1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { birdSender } = await import('@/lib/auth/otp-bird');
    await birdSender.send('+32477704740', '123456');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts a Bearer-authenticated JSON message to the EU endpoint by default', async () => {
    configure();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'sms_1', status: 'accepted' }), { status: 202 }));
    const { birdSender } = await import('@/lib/auth/otp-bird');
    await birdSender.send('+32477704740', '123456');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://eu1.platform.bird.com/v1/sms/messages');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer bk_eu1_testkey');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    expect(body.to).toBe('+32477704740');
    expect(body.from).toBe('ContentBox');
    expect(body.text).toContain('123456');
    expect(body.category).toBe('authentication');
  });

  it('honours BIRD_REGION=us1', async () => {
    configure('us1');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 202 }));
    const { birdSender } = await import('@/lib/auth/otp-bird');
    await birdSender.send('+32477704740', '654321');
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://us1.platform.bird.com/v1/sms/messages');
  });

  it('throws with the status and Bird error detail when the request is rejected', async () => {
    configure();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'invalid_recipient', message: 'to is not a valid number' }), { status: 400 }),
    );
    const { birdSender } = await import('@/lib/auth/otp-bird');
    await expect(birdSender.send('+bad', '000000')).rejects.toThrow(/Bird send failed \(400\): invalid_recipient to is not a valid number/);
  });

  it('also understands a nested { error: { code, message } } body', async () => {
    configure();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'bad key' } }), { status: 401 }),
    );
    const { birdSender } = await import('@/lib/auth/otp-bird');
    await expect(birdSender.send('+32477704740', '000000')).rejects.toThrow(/Bird send failed \(401\): unauthorized bad key/);
  });

  it('still throws cleanly on a non-JSON error body', async () => {
    configure();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>gateway</html>', { status: 502 }));
    const { birdSender } = await import('@/lib/auth/otp-bird');
    await expect(birdSender.send('+32477704740', '000000')).rejects.toThrow(/^Bird send failed \(502\)$/);
  });

  it('with BIRD_TEMPLATE_SLUG set, sends a template body (no text/from/category)', async () => {
    configure();
    process.env.BIRD_TEMPLATE_SLUG = 'bird_otp_verification';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 202 }));
    const { birdSender } = await import('@/lib/auth/otp-bird');
    await birdSender.send('+32477704740', '493021');

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://eu1.platform.bird.com/v1/sms/messages');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.to).toBe('+32477704740');
    expect(body.template).toEqual({ slug: 'bird_otp_verification', parameters: { code: '493021' } });
    // text and template are mutually exclusive; the template picks sender + category.
    expect(body.text).toBeUndefined();
    expect(body.from).toBeUndefined();
    expect(body.category).toBeUndefined();
  });

  it('includes language only when BIRD_TEMPLATE_LANGUAGE is set', async () => {
    configure();
    process.env.BIRD_TEMPLATE_SLUG = 'bird_otp_verification';
    process.env.BIRD_TEMPLATE_LANGUAGE = 'nl';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 202 }));
    const { birdSender } = await import('@/lib/auth/otp-bird');
    await birdSender.send('+32477704740', '493021');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { template: Record<string, unknown> };
    expect(body.template.language).toBe('nl');
  });

  it('without a slug, keeps the free-text body (regression guard)', async () => {
    configure();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 202 }));
    const { birdSender } = await import('@/lib/auth/otp-bird');
    await birdSender.send('+32477704740', '493021');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.template).toBeUndefined();
    expect(String(body.text)).toContain('493021');
    expect(body.category).toBe('authentication');
  });

  it('surfaces a rejected template send with status and detail', async () => {
    configure();
    process.env.BIRD_TEMPLATE_SLUG = 'nope_missing_template';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'template_not_found', message: 'no such slug' }), { status: 404 }),
    );
    const { birdSender } = await import('@/lib/auth/otp-bird');
    await expect(birdSender.send('+32477704740', '493021')).rejects.toThrow(
      /Bird send failed \(404\): template_not_found no such slug/,
    );
  });
});
