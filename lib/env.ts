// Central, validated access to environment variables. Throwing here (server-side)
// is better than a confusing failure deep in a request. Public vars are safe to
// read on the client; everything else is server-only.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  supabaseUrl: () => required('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () => required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  // Server-only below — never import these into client components.
  serviceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  phoneEncryptionKey: () => required('PHONE_ENCRYPTION_KEY'),
  phoneHashKey: () => required('PHONE_HASH_KEY'),
  sessionSecret: () => required('SESSION_SECRET'),
  // Guard against an empty/invalid env value (e.g. "" -> 0) — always a sane positive.
  otpTtlSeconds: () => { const n = Number(process.env.OTP_TTL_SECONDS); return Number.isFinite(n) && n > 0 ? n : 300; },
  otpMaxAttempts: () => { const n = Number(process.env.OTP_MAX_ATTEMPTS); return Number.isFinite(n) && n > 0 ? n : 5; },
  otpSender: () => process.env.OTP_SENDER ?? 'stub',
  // Twilio SMS (real OTP delivery). Authenticated with a Standard API Key
  // (SK sid + secret) over the account, never the raw Auth Token. Returns null
  // until fully configured so the sender can fall back to the stub safely.
  twilio: () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
    const apiKeySid = process.env.TWILIO_API_KEY_SID ?? '';
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET ?? '';
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID ?? '';
    const fromNumber = process.env.TWILIO_FROM_NUMBER ?? '';
    if (!accountSid || !apiKeySid || !apiKeySecret) return null;
    if (!messagingServiceSid && !fromNumber) return null;
    return { accountSid, apiKeySid, apiKeySecret, messagingServiceSid, fromNumber };
  },
  // WebAuthn (admin fingerprint). RP ID must be the registrable domain; origin the
  // full https origin. Local dev falls back to localhost.
  rpId: () => process.env.RP_ID ?? 'localhost',
  appOrigin: () => process.env.APP_ORIGIN ?? 'http://localhost:3000',
  cronSecret: () => process.env.CRON_SECRET ?? '',
};
