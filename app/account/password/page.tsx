'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/app/i18n-provider';

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
  const t = useT();
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
    if (password !== confirm) { setMsg({ kind: 'err', text: t('password.mismatch') }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/password/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsCurrent ? { password, currentPassword } : { password }),
      });
      const j = await readJson(r);
      if (!r.ok) throw new Error(j.error || t('password.errSave', { status: r.status }));
      setPassword(''); setConfirm(''); setCurrentPassword('');
      setMsg({ kind: 'ok', text: t('password.saved') });
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
      if (!r.ok) throw new Error(j.error || t('password.errRemove', { status: r.status }));
      setMsg({ kind: 'ok', text: t('password.removed') });
      setCurrentPassword('');
      await refresh();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  if (loading) return <div className="center"><p className="muted">{t('common.loading')}</p></div>;

  return (
    <div className="center wash">
      <div className="brand-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-512.png" alt="Content24" />
        <div className="wordmark">CONTENT24</div>
        <p className="eyebrow">— {t('login.eyebrowPassword')} —</p>
      </div>
      <h1 style={{ textAlign: 'center' }}>{state?.hasPassword ? t('password.titleChange') : t('password.titleSet')}</h1>
      <p className="muted">{t('password.lead')}</p>

      {mustReauth ? (
        <div className="card">
          <p>{t('password.needsFreshAuth')}</p>
          <div className="row" style={{ marginTop: 16, gap: 8 }}>
            <a href="/login?next=/account/password"><button type="button">{t('password.sendMeACode')}</button></a>
            <a href="/app"><button type="button" className="ghost">{t('common.back')}</button></a>
          </div>
        </div>
      ) : (
      <form onSubmit={save} className="card">
        {needsCurrent && (
          <>
            <label htmlFor="currentPassword">{t('password.currentLabel')}</label>
            <input
              id="currentPassword" type="password" value={currentPassword} autoComplete="current-password"
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <p className="dim" style={{ marginTop: 4 }}>
              <a href="/login?next=/account/password">{t('password.orUseCode')}</a>
            </p>
          </>
        )}

        <label htmlFor="password">{state?.hasPassword ? t('password.newLabel') : t('login.passwordLabel')}</label>
        <input
          id="password" type="password" value={password} autoComplete="new-password"
          placeholder={t('password.placeholder')} onChange={(e) => setPassword(e.target.value)}
        />

        <label htmlFor="confirm">{t('password.repeatLabel')}</label>
        <input
          id="confirm" type="password" value={confirm} autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)}
        />

        <div className="row" style={{ marginTop: 16, gap: 8 }}>
          <button disabled={busy || password.length < 10}>{busy ? t('common.saving') : t('common.save')}</button>
          <a href="/app"><button type="button" className="ghost">{t('common.back')}</button></a>
        </div>
      </form>
      )}

      {state?.hasPassword && (
        <p className="dim" style={{ marginTop: 16 }}>
          <a onClick={() => { if (!busy) void remove(); }} style={{ cursor: 'pointer' }}>
            {t('password.remove')}
          </a>{' '}{t('password.removeHint')}
        </p>
      )}

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
