import 'server-only';

const RESEND_URL = 'https://api.resend.com/emails';

export type EmailSendResult = { ok: true } | { ok: false; status: number; detail: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

// The single place that talks to Resend. Auth, error parsing and the never-log-the-
// recipient rule are written once here; both the fire-and-forget sender and the
// throwing one sit on top, so they can't drift apart.
async function resendPost(to: string, subject: string, text: string): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, status: 0, detail: 'not configured' };

  let res: Response;
  try {
    res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
  } catch {
    return { ok: false, status: 0, detail: 'network error' };
  }
  if (res.ok) return { ok: true };

  // Resend rejects with { statusCode, name, message }. `name` is the part worth
  // reading — an unverified EMAIL_FROM domain is a 403 `validation_error` and is by
  // far the most common setup failure, so surfacing it beats a bare status code.
  let detail = '';
  try {
    const j = (await res.json()) as {
      name?: unknown; message?: unknown; error?: { name?: unknown; message?: unknown };
    };
    const src = j.error ?? j;
    detail = `${src.name ?? ''} ${src.message ?? ''}`.trim();
  } catch {
    // non-JSON error body
  }
  return { ok: false, status: res.status, detail };
}

// Fire-and-forget: a notification email must never break the operation that triggered
// it, so a failure is logged and swallowed. Never logs the recipient or the body.
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const r = await resendPost(to, subject, text);
  if (!r.ok && r.detail !== 'not configured') {
    // eslint-disable-next-line no-console
    console.warn(`[email] send failed (${r.status})${r.detail ? `: ${r.detail}` : ''}`);
  }
  return r.ok;
}

// Same send, but the caller decides what a failure means. The OTP path turns it into a
// thrown error, so sign-in can't report "code sent" when nothing was delivered.
export async function sendEmailChecked(to: string, subject: string, text: string): Promise<EmailSendResult> {
  return resendPost(to, subject, text);
}
