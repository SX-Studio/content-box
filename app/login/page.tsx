'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT, LocaleSwitcher } from '@/app/i18n-provider';

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
  const t = useT();
  const [next, setNext] = useState('/app');
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get('next');
    // '//evil.com' starts with '/' but is protocol-relative — the router leaves the site.
    if (n && n.startsWith('/') && !n.startsWith('//')) { setNext(n); return; }
    // Landing CTAs all point here, so an already-signed-in visitor would be asked to
    // sign in again; send them on instead. Only when there is NO `next`: a caller that
    // asked for a specific destination wants a fresh sign-in, which is exactly how
    // /account/password gets its 15-minute fresh-auth proof. Redirecting that away
    // would put the password page back in the dead end it was just taken out of.
    void (async () => {
      const r = await fetch('/api/me').catch(() => null);
      if (r?.ok) router.replace('/app');
    })();
  }, [router]);

  const [channel, setChannel] = useState<Channel>('sms');
  // 'code' = the OTP round trip; 'password' = straight in with a stored password.
  const [mode, setMode] = useState<'code' | 'password'>('code');
  const [password, setPassword] = useState('');
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
    setPassword('');
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/auth/password/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...identifier, password }),
      });
      const j = await readJson(r);
      if (!r.ok) throw new Error(j.error || t('login.errSignIn', { status: r.status }));
      router.push(next);
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
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
      // `detail` only appears when the server has OTP_DEBUG_ERRORS on; show it so a
      // misconfigured sender is visible here instead of only in the server logs.
      if (!r.ok) {
        const detail = typeof j.detail === 'string' ? j.detail : '';
        throw new Error([j.error || t('login.errSendCode', { status: r.status }), detail].filter(Boolean).join(' — '));
      }
      setStep('code');
      setMsg({
        kind: 'ok',
        text: channel === 'email' ? t('login.codeSentEmail') : t('login.codeSentSms'),
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
      if (!r.ok) throw new Error(j.error || t('login.errVerify', { status: r.status }));
      router.push(next);
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center wash">
      <div className="brand-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-512.png" alt="Content24" />
        <div className="wordmark">CONTENT24</div>
        <p className="eyebrow">— {mode === 'password' ? t('login.eyebrowPassword') : t('login.eyebrowSignIn')} —</p>
      </div>
      <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
        {mode === 'password'
          ? t('login.leadPassword')
          : channel === 'email'
            ? t('login.leadEmailPrivate')
            : t('login.leadSms')}
      </p>
      <div style={{ marginTop: 12 }}><LocaleSwitcher /></div>

      {step === 'identify' ? (
        <form onSubmit={mode === 'password' ? signInWithPassword : start} className="card">
          <div className="seg" style={{ marginBottom: 14 }} role="tablist" aria-label={t('login.methodLabel')}>
            <button type="button" role="tab" aria-selected={channel === 'sms'} className={channel === 'sms' ? 'on' : ''} onClick={() => switchChannel('sms')}>{t('login.tabPhone')}</button>
            <button type="button" role="tab" aria-selected={channel === 'email'} className={channel === 'email' ? 'on' : ''} onClick={() => switchChannel('email')}>{t('login.tabEmail')}</button>
          </div>

          {channel === 'email' ? (
            <>
              <label htmlFor="email">{t('login.emailLabel')}</label>
              <input id="email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
            </>
          ) : (
            <>
              <label htmlFor="phone">{t('login.phoneLabel')}</label>
              <input id="phone" placeholder="+32470123456" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </>
          )}

          {mode === 'password' && (
            <>
              <label htmlFor="pw">{t('login.passwordLabel')}</label>
              <input
                id="pw" type="password" value={password} autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            {mode === 'password' ? (
              <button disabled={busy || !canStart || !password}>{busy ? t('login.signingIn') : t('login.signIn')}</button>
            ) : (
              <button disabled={busy || !canStart}>{busy ? t('login.sending') : t('login.sendCode')}</button>
            )}
          </div>

          <p className="dim" style={{ marginTop: 12 }}>
            {mode === 'password' ? (
              <a onClick={() => { setMode('code'); setMsg(null); setPassword(''); }} style={{ cursor: 'pointer' }}>
                {t('login.useCode')}
              </a>
            ) : (
              <a onClick={() => { setMode('password'); setMsg(null); }} style={{ cursor: 'pointer' }}>
                {t('login.usePassword')}
              </a>
            )}
          </p>
        </form>
      ) : (
        <form onSubmit={verify} className="card">
          <div className="dim">{t('login.codeFor')} <span className="mono">{identifierShown}</span> · <a onClick={() => { setStep('identify'); setCode(''); }} style={{ cursor: 'pointer' }}>{t('common.change')}</a></div>
          <label htmlFor="code">{t('login.codeLabel')}</label>
          <div className="code-wrap">
            <input
              id="code" inputMode="numeric" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoComplete="one-time-code" autoFocus aria-label={t('login.codeLabel')}
            />
            <div className="code-row" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`code-cell${code[i] ? ' filled' : ''}${i === code.length ? ' next' : ''}`}>
                  {code[i] ?? '·'}
                </div>
              ))}
            </div>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="alt" disabled={busy || code.length !== 6}>{busy ? t('login.verifying') : t('login.verify')}</button>
          </div>
        </form>
      )}

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
