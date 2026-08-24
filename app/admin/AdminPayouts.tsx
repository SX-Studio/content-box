'use client';
import { useEffect, useState, useCallback } from 'react';

type Payout = { public_id: string; creator: string; amount_tokens: number; eur_cents: number; requested_at: string };

// Operator payout queue — pending requests with Paid / Reject actions. "Paid"
// records that the money was sent off-platform (earnings become withdrawn);
// "Reject" releases the earnings back to the creator's available balance.
export default function AdminPayouts() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/payouts');
    if (r.ok) setPayouts((await r.json()).payouts || []);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(payoutId: string, paid: boolean) {
    if (!paid && !confirm('Reject this payout? The earnings return to the creator’s available balance.')) return;
    setBusyId(payoutId); setMsg(null);
    try {
      const r = await fetch('/api/admin/payouts/decide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId, paid }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not update payout');
      setMsg(`${payoutId} marked ${paid ? 'paid' : 'rejected'}.`);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally { setBusyId(null); }
  }

  const eur = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  return (
    <div className="card">
      <strong>Payout requests</strong>
      <p className="dim" style={{ fontSize: 12, marginTop: 2 }}>Creators requesting withdrawal of their available earnings.</p>

      {loaded && payouts.length === 0 && <p className="dim" style={{ margin: '8px 0 0' }}>No pending payout requests.</p>}

      {payouts.map((p) => (
        <div key={p.public_id} className="between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span className="mono">{p.creator}</span>
            <span className="dim" style={{ marginLeft: 8 }}>{p.public_id} · {new Date(p.requested_at).toLocaleDateString()}</span>
            <div style={{ fontWeight: 700 }}>{eur(p.eur_cents)} <span className="dim" style={{ fontWeight: 400 }}>(◈ {p.amount_tokens})</span></div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="sm" disabled={busyId === p.public_id} onClick={() => decide(p.public_id, true)}>Mark paid</button>
            <button className="ghost sm" disabled={busyId === p.public_id} onClick={() => decide(p.public_id, false)}>Reject</button>
          </div>
        </div>
      ))}

      {msg && <div className="msg" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
