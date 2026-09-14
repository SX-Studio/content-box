'use client';
import { useEffect, useState } from 'react';

type State = { hasPassword: boolean; freshAuth: boolean } | null;

async function readJson(r: Response): Promise<{ error?: string; [k: string]: unknown }> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as { error?: string };
  } catch {
    return { error: text.slice(0, 200) };
  }
}

export default function PasswordSettingsPage() {
  const [state, setState] = useState<State>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const r = await fetch('/api/auth/password/set');
    if (r.status === 401) { window.location.href = '/login?next=/account/password'; return; }
    const j = await readJson(r) as { hasPassword?: boolean; freshAuth?: boolean };
    setState({ hasPassword: Boolean(j.hasPassword), freshAuth: Boolean(j.freshAuth) });
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, []);

  // Changing a login factor needs either a fresh code or the current password — the
  // 30-day session alone is not enough, so the form says which one is missing.
  const needsCurrent = Boolean(state?.hasPassword) && !state?.freshAuth;
  // No password yet AND no fresh code is the one combination with nothing to offer:
  // there is no current password to type, so the form can only ever 403. Send them
  // for a code instead of letting them fill in a form that cannot succeed.
  const mustReauth = !state?.hasPassword && !state?.freshAuth;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setMsg({ kind: 'err', text: 'The two passwords do not match' }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/password/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsCurrent ? { password, currentPassword } : { password }),
      });
      const j = await readJson(r);
      if (!r.ok) throw new Error(j.error || `Could not save (HTTP ${r.status})`);
      setPassword(''); setConfirm(''); setCurrentPassword('');
      setMsg({ kind: 'ok', text: 'Password saved. You can now sign in with it instead of a code.' });
      await refresh();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/password/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsCurrent ? { remove: true, currentPassword } : { remove: true }),
      });
      const j = await readJson(r);
      if (!r.ok) throw new Error(j.error || `Could not remove (HTTP ${r.status})`);
      setMsg({ kind: 'ok', text: 'Password removed. Sign in with a code from now on.' });
      setCurrentPassword('');
      await refresh();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  if (loading) return <div className="center"><p className="muted">Loading…</p></div>;

  return (
    <div className="center wash">
      <div className="brand-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-512.png" alt="Content24" />
        <div className="wordmark">CONTENT24</div>
        <p className="eyebrow">— Wachtwoord —</p>
      </div>
      <h1 style={{ textAlign: 'center' }}>{state?.hasPassword ? 'Wijzig je wachtwoord' : 'Stel een wachtwoord in'}</h1>
      <p className="muted">
        A password lets you sign in without waiting for a code. You can always still sign
        in with a code — and a code is how you get back in if you forget the password.
      </p>

      {mustReauth ? (
        <div className="card">
          <p>
            Voor het instellen van een wachtwoord is een verse code nodig. Je bent
            ingelogd, maar die sessie loopt 30 dagen — te lang om er een permanente
            login mee aan te maken. Een code bewijst dat jij het nu bent.
          </p>
          <div className="row" style={{ marginTop: 16, gap: 8 }}>
            <a href="/login?next=/account/password"><button type="button">Stuur me een code</button></a>
            <a href="/app"><button type="button" className="ghost">Terug</button></a>
          </div>
        </div>
      ) : (
      <form onSubmit={save} className="card">
        {needsCurrent && (
          <>
            <label htmlFor="currentPassword">Huidig wachtwoord</label>
            <input
              id="currentPassword" type="password" value={currentPassword} autoComplete="current-password"
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <p className="dim" style={{ marginTop: 4 }}>
              Or <a href="/login?next=/account/password">log in met een code</a> to change it without this.
            </p>
          </>
        )}

        <label htmlFor="password">{state?.hasPassword ? 'Nieuw wachtwoord' : 'Wachtwoord'}</label>
        <input
          id="password" type="password" value={password} autoComplete="new-password"
          placeholder="minimaal 10 tekens" onChange={(e) => setPassword(e.target.value)}
        />

        <label htmlFor="confirm">Herhaal</label>
        <input
          id="confirm" type="password" value={confirm} autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)}
        />

        <div className="row" style={{ marginTop: 16, gap: 8 }}>
          <button disabled={busy || password.length < 10}>{busy ? 'Opslaan…' : 'Opslaan'}</button>
          <a href="/app"><button type="button" className="ghost">Terug</button></a>
        </div>
      </form>
      )}

      {state?.hasPassword && (
        <p className="dim" style={{ marginTop: 16 }}>
          <a onClick={() => { if (!busy) void remove(); }} style={{ cursor: 'pointer' }}>
            Verwijder mijn wachtwoord
          </a>{' '}— go back to codes only.
        </p>
      )}

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
