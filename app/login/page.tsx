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

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState('/app');
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get('next');
    if (n && n.startsWith('/')) setNext(n);
  }, []);

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/auth/otp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const j = await readJson(r);
      if (!r.ok) throw new Error(j.error || `Could not send code (HTTP ${r.status})`);
      setStep('code');
      setMsg({ kind: 'ok', text: 'Code sent. In this preview it is printed in the server console.' });
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
        body: JSON.stringify({ phone, code }),
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
      <p className="muted">We&apos;ll text you a 6-digit code to verify your number.</p>

      {step === 'phone' ? (
        <form onSubmit={start} className="card">
          <label htmlFor="phone">Phone number (E.164)</label>
          <input id="phone" placeholder="+32470123456" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          <div className="row" style={{ marginTop: 16 }}>
            <button disabled={busy || !phone}>{busy ? 'Sending…' : 'Send code'}</button>
          </div>
        </form>
      ) : (
        <form onSubmit={verify} className="card">
          <div className="dim">Code for <span className="mono">{phone}</span> · <a onClick={() => { setStep('phone'); setCode(''); }} style={{ cursor: 'pointer' }}>change</a></div>
          <label htmlFor="code">6-digit code</label>
          <input id="code" inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <div className="row" style={{ marginTop: 16 }}>
            <button disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
          </div>
        </form>
      )}

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
