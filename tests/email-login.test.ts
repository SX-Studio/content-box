import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { randomBytes } from 'crypto';

// Deterministic 32-byte keys for the run, set before the modules are imported.
beforeAll(() => {
  process.env.PHONE_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  process.env.PHONE_HASH_KEY = randomBytes(32).toString('hex');
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('login email normalisation', () => {
  it('trims and lowercases so the same address always hashes the same', async () => {
    const { normalizeLoginEmail } = await import('@/lib/crypto');
    expect(normalizeLoginEmail('  Jane.Doe@Example.COM ')).toBe('jane.doe@example.com');
  });

  it('rejects empty, malformed and overlong input', async () => {
    const { normalizeLoginEmail } = await import('@/lib/crypto');
    expect(() => normalizeLoginEmail('')).toThrow();
    expect(() => normalizeLoginEmail('   ')).toThrow();
    expect(() => normalizeLoginEmail('not-an-email')).toThrow();
    expect(() => normalizeLoginEmail('a@b')).toThrow();
    expect(() => normalizeLoginEmail('has space@example.com')).toThrow();
    expect(() => normalizeLoginEmail(`${'x'.repeat(250)}@example.com`)).toThrow();
  });
});

describe('email crypto — same privacy model as phone', () => {
  it('encrypts and decrypts round-trip without leaking plaintext', async () => {
    const { encryptEmail, decryptEmail } = await import('@/lib/crypto');
    const email = 'jane.doe@example.com';
    const blob = encryptEmail(email);
    expect(Buffer.isBuffer(blob)).toBe(true);
    expect(blob.toString('utf8')).not.toContain('jane');
    expect(blob.toString('utf8')).not.toContain('example');
    expect(decryptEmail(blob)).toBe(email);
  });

  it('two encryptions of the same email differ (random IV)', async () => {
    const { encryptEmail } = await import('@/lib/crypto');
    expect(encryptEmail('jane@example.com').equals(encryptEmail('jane@example.com'))).toBe(false);
  });

  it('produces a stable, keyed lookup hash', async () => {
    const { emailHash } = await import('@/lib/crypto');
    const a = emailHash('jane@example.com');
    const b = emailHash('jane@example.com');
    const c = emailHash('john@example.com');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is domain-separated from phone hashes (same input never collides)', async () => {
    const { emailHash, phoneHash } = await import('@/lib/crypto');
    // Both hash the identical string; the namespaces must still never meet.
    expect(emailHash('shared-value')).not.toBe(phoneHash('shared-value'));
  });
});

describe('maskEmail — never log a whole address', () => {
  it('keeps the first character and the domain, hides the rest of the local part', async () => {
    const { maskEmail } = await import('@/lib/auth/otp-email');
    const masked = maskEmail('jane.doe@example.com');
    expect(masked.startsWith('j')).toBe(true);
    expect(masked.endsWith('@example.com')).toBe(true);
    expect(masked).not.toContain('jane.doe');
    expect(masked).toMatch(/^j\*+@example\.com$/);
  });

  it('handles a one-character local part and garbage input', async () => {
    const { maskEmail } = await import('@/lib/auth/otp-email');
    expect(maskEmail('a@b.co')).toMatch(/^a\*+@b\.co$/);
    expect(maskEmail('nonsense')).toBe('***');
  });
});

describe('resolveLoginIdentifier — exactly one channel per request', () => {
  it('routes a phone to the sms channel with its E.164 form and phone hash', async () => {
    const { resolveLoginIdentifier } = await import('@/lib/auth/channel');
    const { phoneHash } = await import('@/lib/crypto');
    const id = resolveLoginIdentifier({ phone: ' +32 470 12 34 56 ' });
    expect(id.channel).toBe('sms');
    expect(id.identifier).toBe('+32470123456');
    expect(id.hash).toBe(phoneHash('+32470123456'));
  });

  it('routes an email to the email channel, normalised, with the email hash', async () => {
    const { resolveLoginIdentifier } = await import('@/lib/auth/channel');
    const { emailHash } = await import('@/lib/crypto');
    const id = resolveLoginIdentifier({ email: ' Jane@Example.com ' });
    expect(id.channel).toBe('email');
    expect(id.identifier).toBe('jane@example.com');
    expect(id.hash).toBe(emailHash('jane@example.com'));
  });

  it('rejects both, neither, and a malformed email', async () => {
    const { resolveLoginIdentifier } = await import('@/lib/auth/channel');
    expect(() => resolveLoginIdentifier({ phone: '+32470123456', email: 'a@b.co' })).toThrow(/not both/);
    expect(() => resolveLoginIdentifier({})).toThrow();
    expect(() => resolveLoginIdentifier(null)).toThrow();
    expect(() => resolveLoginIdentifier({ email: 'nope' })).toThrow();
  });
});

describe('sendEmailOtp fallback policy', () => {
  it('in explicit stub mode logs a MASKED address with the code, and does not throw', async () => {
    process.env.OTP_SENDER = 'stub';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendEmailOtp, emailLoginAvailable } = await import('@/lib/auth/otp-email');
    expect(emailLoginAvailable()).toBe(true);
    await expect(sendEmailOtp('jane.doe@example.com', '123456')).resolves.toBeUndefined();
    const line = String(log.mock.calls[0]?.[0] ?? '');
    expect(line).toContain('123456');
    expect(line).toContain('@example.com');
    expect(line).not.toContain('jane.doe');
  });

  it('with real SMS configured but no Resend, refuses rather than leaking codes to logs', async () => {
    process.env.OTP_SENDER = 'twilio';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendEmailOtp, emailLoginAvailable, EmailLoginUnavailable } = await import('@/lib/auth/otp-email');
    expect(emailLoginAvailable()).toBe(false);
    await expect(sendEmailOtp('jane@example.com', '123456')).rejects.toBeInstanceOf(EmailLoginUnavailable);
    expect(log).not.toHaveBeenCalled();
  });
});
