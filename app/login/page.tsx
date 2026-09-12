'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Tolerate empty/non-JSON responses: a bodyless 500 (e.g. a server route that threw
// before returning) must surface a real message, not "Unexpected end of JSON input".
async function readJson(r: Response): Promise<{ error?: string; [k: string]: unknown }> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as { error?: string };
  } catch {
    return { error: text.slice(0, 200) };
  }
}

type Channel = 'sms' | 'email';

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState('/app');
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get('next');
    if (n && n.startsWith('/')) setNext(n);
  }, []);

  const [channel, setChannel] = useState<Channel>('sms');
  const [step, setStep] = useState<'identify' | 'code'>('identify');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // The server accepts exactly one identifier per request; send only the active one.
  const identifier = channel === 'email' ? { email } : { phone };
  const identifierShown = channel === 'email' ? email : phone;
  const canStart = channel === 'email' ? email.includes('@') : Boolean(phone);

  function switchChannel(c: Channel) {
    setChannel(c);
    setMsg(null);
    setCode('');
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/auth/otp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(identifier),
      });
      const j = await readJson(r);
      if (!r.ok) throw new Error(j.error || `Could not send code (HTTP ${r.status})`);
      setStep('code');
      setMsg({
        kind: 'ok',
        text: channel === 'email'
          ? 'Code sent. Check your inbox (and your spam folder).'
          : 'Code sent. In this preview it is printed in the server console.',
      });
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...identifier, code }),
      });
      const j = await readJson(r);
      if (!r.ok) throw new Error(j.error || `Verification failed (HTTP ${r.status})`);
      router.push(next);
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <p className="eyebrow">Content Box</p>
      <h1>Sign in</h1>
      <p className="muted">
        {channel === 'email'
          ? 'We’ll email you a 6-digit code. Your address stays private — other members never see it.'
          : 'We’ll text you a 6-digit code to verify your number.'}
      </p>

      {step === 'identify' ? (
        <form onSubmit={start} className="card">
          <div className="row" style={{ gap: 8, marginBottom: 12 }} role="tablist" aria-label="Sign-in method">
            <button type="button" role="tab" aria-selected={channel === 'sms'} className={channel === 'sms' ? '' : 'ghost'} onClick={() => switchChannel('sms')}>Phone</button>
            <button type="button" role="tab" aria-selected={channel === 'email'} className={channel === 'email' ? '' : 'ghost'} onClick={() => switchChannel('email')}>Email</button>
          </div>

          {channel === 'email' ? (
            <>
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
            </>
          ) : (
            <>
              <label htmlFor="phone">Phone number (E.164)</label>
              <input id="phone" placeholder="+32470123456" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            <button disabled={busy || !canStart}>{busy ? 'Sending…' : 'Send code'}</button>
          </div>
        </form>
      ) : (
        <form onSubmit={verify} className="card">
          <div className="dim">Code for <span className="mono">{identifierShown}</span> · <a onClick={() => { setStep('identify'); setCode(''); }} style={{ cursor: 'pointer' }}>change</a></div>
          <label htmlFor="code">6-digit code</label>
          <input id="code" inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" />
          <div className="row" style={{ marginTop: 16 }}>
            <button disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
          </div>
        </form>
      )}

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
