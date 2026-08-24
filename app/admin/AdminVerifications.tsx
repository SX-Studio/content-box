'use client';
import { useEffect, useState, useCallback } from 'react';

type Verification = {
  id: string; account: string; full_name: string; date_of_birth: string; age: number;
  country: string | null; document_type: string; submitted_at: string;
  document_url: string | null; selfie_url: string | null;
};

// Reviewer queue for creator 18+/ID verification. Document + selfie load from
// short-lived signed URLs; approving flips the account's publish gate on.
export default function AdminVerifications() {
  const [items, setItems] = useState<Verification[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/verifications');
    if (r.ok) setItems((await r.json()).verifications || []);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(id: string, approve: boolean) {
    let reason: string | null = null;
    if (!approve) {
      reason = prompt('Reason for declining (shown to the creator):') || '';
      if (!reason.trim()) return;
    }
    setBusyId(id); setMsg(null);
    try {
      const r = await fetch('/api/admin/verifications/decide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, approve, reason }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not update');
      setMsg(`Verification ${approve ? 'approved' : 'declined'}.`);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally { setBusyId(null); }
  }

  return (
    <div className="card">
      <strong>Identity verifications</strong>
      <p className="dim" style={{ fontSize: 12, marginTop: 2 }}>Creator 18+/ID review. Approving lets the creator publish content.</p>

      {loaded && items.length === 0 && <p className="dim" style={{ margin: '8px 0 0' }}>No pending verifications.</p>}

      {items.map((v) => (
        <div key={v.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
          <div className="between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong>{v.full_name}</strong> <span className="dim">· age {v.age}</span>
              <div className="dim" style={{ fontSize: 13 }}>
                <span className="mono">{v.account}</span> · {v.document_type}{v.country ? ` · ${v.country}` : ''} · DOB {v.date_of_birth}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="sm" disabled={busyId === v.id} onClick={() => decide(v.id, true)}>Approve</button>
              <button className="ghost sm" disabled={busyId === v.id} onClick={() => decide(v.id, false)}>Decline</button>
            </div>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {v.document_url && (
              <a href={v.document_url} target="_blank" rel="noreferrer">
                <img src={v.document_url} alt="ID document" style={{ height: 96, borderRadius: 8, border: '1px solid var(--line)' }} />
              </a>
            )}
            {v.selfie_url && (
              <a href={v.selfie_url} target="_blank" rel="noreferrer">
                <img src={v.selfie_url} alt="Selfie" style={{ height: 96, borderRadius: 8, border: '1px solid var(--line)' }} />
              </a>
            )}
          </div>
        </div>
      ))}

      {msg && <div className="msg" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
