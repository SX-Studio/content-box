import 'server-only';

const RESEND_URL = 'https://api.resend.com/emails';

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

// Best-effort transactional email via Resend (plain fetch, no SDK). Returns false
// instead of throwing when unconfigured or on error, so callers treat it as
// fire-and-forget. Never logs the recipient or the body.
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[email] send failed (${res.status})`);
      return false;
    }
    return true;
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[email] send error');
    return false;
  }
}
