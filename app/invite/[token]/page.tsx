'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/app/i18n-provider';

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const t = useT();
  const [state, setState] = useState<'checking' | 'ready' | 'anon'>('checking');
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/me');
      setState(r.ok ? 'ready' : 'anon');
    })();
  }, []);

  async function accept() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/invitations/${params.token}/accept`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || t('invite.errAccept'));
      setMsg({ kind: 'ok', text: t('invite.joined', { box: j.box, role: j.role }) });
      setTimeout(() => router.push('/app'), 1200);
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally { setBusy(false); }
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

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
