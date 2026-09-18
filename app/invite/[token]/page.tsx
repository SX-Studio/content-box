'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/app/i18n-provider';

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const t = useT();
  // 'nickname' is a step, not a gate: the invitation is already accepted by the time
  // it shows, and Skip leaves the account on its public ID.
  const [state, setState] = useState<'checking' | 'ready' | 'anon' | 'nickname'>('checking');
  const [hasName, setHasName] = useState(false);
  const [nick, setNick] = useState('');
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/me');
      if (!r.ok) { setState('anon'); return; }
      const j = await r.json().catch(() => ({}));
      setHasName(Boolean(j?.account?.display_name));
      setState('ready');
    })();
  }, []);

  async function accept() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/invitations/${params.token}/accept`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || t('invite.errAccept'));
      setMsg({ kind: 'ok', text: t('invite.joined', { box: j.box, role: j.role }) });
      // Someone who already chose a nickname is not asked again.
      if (hasName) { setTimeout(() => router.push('/app'), 1200); return; }
      setState('nickname');
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  async function saveNickname() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/account/display-name', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: nick }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || t('nickname.errSave'));
      router.push('/app');
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
      setBusy(false);
    }
  }

  return (
    <div className="center wash">
      <div className="brand-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-512.png" alt="Content24" />
        <div className="wordmark">CONTENT24</div>
        <p className="eyebrow">— {t('invite.eyebrow')} —</p>
      </div>
      <h1 style={{ textAlign: 'center' }}>{t('invite.title')}</h1>

      {state === 'checking' && <p className="dim">{t('invite.checking')}</p>}

      {state === 'anon' && (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>{t('invite.anonBody')}</p>
          <a href={`/login?next=/invite/${params.token}`}><button>{t('invite.verifyPhone')}</button></a>
        </div>
      )}

      {state === 'ready' && (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>{t('invite.readyBody')}</p>
          <button onClick={accept} disabled={busy}>{busy ? t('invite.joining') : t('invite.accept')}</button>
        </div>
      )}

      {state === 'nickname' && (
        <form
          className="card"
          onSubmit={(e) => { e.preventDefault(); void saveNickname(); }}
        >
          <div className="dim" style={{ fontWeight: 600 }}>{t('nickname.inviteTitle')}</div>
          <p className="muted" style={{ marginTop: 4 }}>{t('nickname.inviteBody')}</p>
          <label htmlFor="nick">{t('nickname.label')}</label>
          <input
            id="nick" value={nick} onChange={(e) => setNick(e.target.value)}
            placeholder={t('nickname.placeholder')} maxLength={24} autoFocus autoComplete="nickname"
          />
          <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>{t('nickname.hint')}</div>
          <div className="row" style={{ marginTop: 16, gap: 8 }}>
            <button disabled={busy || nick.trim().length < 2}>{busy ? t('common.saving') : t('nickname.saveAndContinue')}</button>
            <button type="button" className="ghost" disabled={busy} onClick={() => router.push('/app')}>{t('nickname.skip')}</button>
          </div>
        </form>
      )}

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
