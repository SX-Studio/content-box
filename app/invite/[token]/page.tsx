'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
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
      if (!r.ok) throw new Error(j.error || 'Could not accept invitation');
      setMsg({ kind: 'ok', text: `Joined ${j.box} as ${j.role}. Redirecting…` });
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
        <p className="eyebrow">— Uitnodiging —</p>
      </div>
      <h1 style={{ textAlign: 'center' }}>Je bent uitgenodigd voor een box</h1>

      {state === 'checking' && <p className="dim">Checking…</p>}

      {state === 'anon' && (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>First verify your phone number — it must match the number this invite was sent to.</p>
          <a href={`/login?next=/invite/${params.token}`}><button>Verify my phone</button></a>
        </div>
      )}

      {state === 'ready' && (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>You&apos;re signed in. Accept to join the box.</p>
          <button onClick={accept} disabled={busy}>{busy ? 'Joining…' : 'Accept invitation'}</button>
        </div>
      )}

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
