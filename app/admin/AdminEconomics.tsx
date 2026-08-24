'use client';
import { useEffect, useState, useCallback } from 'react';

// Field metadata mirrors ECONOMICS in lib/config (server-only, can't import here).
const FIELDS: { key: string; label: string; step: string; help: string }[] = [
  { key: 'payout_threshold_eur', label: 'Payout threshold (€)', step: '1', help: 'Minimum available earnings before a creator can request a payout.' },
  { key: 'creator_split', label: 'Creator split (0–1)', step: '0.01', help: 'Creator’s share of each rental (0.8 = 80%). Applies to future rentals.' },
  { key: 'tokens_per_euro', label: 'Tokens per euro', step: '1', help: 'How many tokens €1 is worth. Drives payout €-conversion and wallet display. Package prices stay fixed in code.' },
  { key: 'rental_hours', label: 'Rental duration (hours)', step: '1', help: 'How long a rental stays active. Applies to future rentals.' },
  { key: 'invitation_ttl_hours', label: 'Invitation TTL (hours)', step: '1', help: 'How long an invite link stays valid.' },
];

export default function AdminEconomics() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/config');
    if (r.ok) {
      const j = await r.json();
      setSaved(j.economics);
      setValues(Object.fromEntries(Object.entries(j.economics).map(([k, v]) => [k, String(v)])));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    // Send only changed fields.
    const updates: Record<string, number> = {};
    for (const f of FIELDS) {
      if (values[f.key] !== undefined && Number(values[f.key]) !== saved[f.key]) updates[f.key] = Number(values[f.key]);
    }
    if (Object.keys(updates).length === 0) { setMsg({ kind: 'ok', text: 'Nothing changed.' }); return; }

    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not save');
      setSaved(j.economics);
      setValues(Object.fromEntries(Object.entries(j.economics).map(([k, v]) => [k, String(v)])));
      setMsg({ kind: 'ok', text: 'Economics updated.' });
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally { setBusy(false); }
  }

  const dirty = FIELDS.some((f) => values[f.key] !== undefined && Number(values[f.key]) !== saved[f.key]);

  return (
    <div className="card">
      <strong>Economics</strong>
      <p className="dim" style={{ fontSize: 12, marginTop: 2 }}>Token economics, editable without a deploy. Changes apply to future rentals/payouts.</p>

      <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
        {FIELDS.map((f) => (
          <div key={f.key} className="between" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label htmlFor={`eco-${f.key}`} style={{ fontWeight: 600 }}>{f.label}</label>
              <div className="dim" style={{ fontSize: 12 }}>{f.help}</div>
            </div>
            <input
              id={`eco-${f.key}`}
              type="number"
              step={f.step}
              inputMode="decimal"
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              style={{ flex: '0 0 120px', textAlign: 'right' }}
            />
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="sm" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save economics'}</button>
      </div>
      {msg && <div className={`msg ${msg.kind}`} style={{ marginTop: 10 }}>{msg.text}</div>}
    </div>
  );
}
