'use client';
import { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export default function AdminUnlockPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function unlock() {
    setError(null); setInfo(null); setBusy(true);
    try {
      const optRes = await fetch('/api/admin/webauthn/authenticate/options', { method: 'POST' });
      if (optRes.status === 401) { window.location.href = '/login?next=/admin'; return; }
      if (optRes.status === 404) { setError('This account is not an admin.'); return; }
      if (!optRes.ok) throw new Error('Could not start unlock');
      const options = await optRes.json();
      if (options.needsRegister) { await register(); return; }
      const assertion = await startAuthentication({ optionsJSON: options });
      const vr = await fetch('/api/admin/webauthn/authenticate/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: assertion }),
      });
      if (!vr.ok) throw new Error('Fingerprint not verified');
      window.location.href = '/admin';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unlock failed');
    } finally { setBusy(false); }
  }

  async function register() {
    setError(null); setBusy(true);
    try {
      const optRes = await fetch('/api/admin/webauthn/register/options', { method: 'POST' });
      if (optRes.status === 401) { window.location.href = '/login?next=/admin'; return; }
      if (optRes.status === 404) { setError('This account is not an admin.'); return; }
      if (!optRes.ok) throw new Error('Could not start registration');
      const options = await optRes.json();
      const attestation = await startRegistration({ optionsJSON: options });
      const vr = await fetch('/api/admin/webauthn/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: attestation, deviceLabel: navigator.userAgent.slice(0, 80) }),
      });
      if (!vr.ok) throw new Error('Could not register fingerprint');
      setInfo('Fingerprint registered.');
      window.location.href = '/admin';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="brand-mark sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-512.png" alt="Content24" />
        <div className="wordmark">ADMIN</div>
        <p className="eyebrow">— Unlock —</p>
      </div>
      <h1 style={{ textAlign: 'center' }}>Unlock</h1>
      <div className="card">
        <p className="dim" style={{ marginTop: 0 }}>Confirm your fingerprint to open the admin backend.</p>
        <div className="row" style={{ flexDirection: 'column', gap: 8 }}>
          <button onClick={unlock} disabled={busy}>{busy ? 'Waiting for fingerprint…' : 'Unlock with fingerprint'}</button>
          <button className="ghost" onClick={register} disabled={busy}>Register a new fingerprint on this device</button>
        </div>
        {info && <p style={{ color: 'var(--ok)', fontSize: 13 }}>{info}</p>}
        {error && <p style={{ color: 'var(--bad)', fontSize: 13 }}>{error}</p>}
      </div>
    </div>
  );
}
