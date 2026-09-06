'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { boxCss, BottomNav } from '@/app/box-ui';
import { PACKAGES } from '@/lib/packages';

type LedgerRow = {
  type: string;
  amount_tokens: number;
  ref_type: string | null;
  ref_id: string | null;
  balance_after: number;
  created_at: string;
};

// Friendly label for a ledger row from its type + refs.
function describe(r: LedgerRow): { title: string; sub: string } {
  const t = r.type.toLowerCase();
  if (t === 'topup') return { title: 'Top-up', sub: r.ref_type === 'dev_topup' ? 'dev top-up' : 'top-up' };
  if (t === 'purchase') return { title: 'Token purchase', sub: `via payment provider${r.ref_id ? ' · ' + r.ref_id : ''}` };
  if (t === 'rent' || t === 'rental' || t === 'spend') return { title: `Rental${r.ref_id ? ' · ' + r.ref_id : ''}`, sub: '24u toegang' };
  if (t === 'payout' || t === 'earning' || t === 'earn') return { title: 'Creator earning', sub: r.ref_id || 'payout' };
  return { title: r.type, sub: [r.ref_type, r.ref_id].filter(Boolean).join(' · ') };
}

export default function WalletPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [accountId, setAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast((t) => (t === m ? null : t)), 2600); }, []);

  const load = useCallback(async () => {
    const [w, me] = await Promise.all([fetch('/api/wallet'), fetch('/api/me')]);
    if (w.status === 401 || me.status === 401) { router.push('/login?next=/wallet'); return; }
    if (w.ok) { const j = await w.json(); setBalance(j.balance ?? 0); setLedger(j.ledger || []); }
    if (me.ok) setAccountId((await me.json()).account?.public_id || '');
    setLoading(false);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  // Buy a package: try the real PSP (Verotel) → redirect to hosted payment; if the
  // PSP isn't configured yet (pre-production), fall back to the dev top-up.
  async function buy(pkgId: string, tokens: number) {
    if (busy) return;
    setBusy(pkgId);
    try {
      const r = await fetch('/api/wallet/purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkgId }),
      });
      const j = await r.json();
      if (r.ok && j.url) { window.location.href = j.url; return; }
      if (r.ok && j.configured === false) {
        const t = await fetch('/api/wallet/topup', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: tokens }),
        });
        const tj = await t.json();
        if (t.ok) { await load(); flash(`+${tokens} tokens toegevoegd (dev)`); }
        else flash(tj.error || 'Betaling binnenkort beschikbaar');
        return;
      }
      flash(j.error || 'Kon aankoop niet starten');
    } catch (e) { flash((e as Error).message); } finally { setBusy(null); }
  }

  if (loading) return <div className="boxui"><style>{boxCss}</style><p className="bx-loading">Loading…</p></div>;

  const eur = ((balance ?? 0) / 100).toFixed(2);

  return (
    <div className="boxui">
      <style>{boxCss}</style>

      <header className="bx-top">
        <div className="bx-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" /></svg>
        </div>
        <div className="bx-titles">
          <div className="bx-name">Wallet</div>
          <div className="bx-sub">tokens · transactie-ledger</div>
        </div>
        <a href="/discover" className="bx-chip" title="Discover">◧ Discover</a>
        <a href="/app" className="bx-chip" title="Dashboard">↩ Dashboard</a>
      </header>

      <div className="bx-balcard">
        <div className="lab">User wallet{accountId ? ` · ${accountId}` : ''}</div>
        <div className="big">{balance ?? 0} <span>tokens</span></div>
        <div className="eur">≈ €{eur} · 100 tokens = €1</div>
      </div>

      <div className="bx-ledlab">Koop tokens</div>
      <div className="bx-pkgs">
        {PACKAGES.map((p) => (
          <button key={p.id} className="bx-pkg" disabled={!!busy} onClick={() => buy(p.id, p.tokens)}>
            <div className="tk">◈ {p.tokens}</div>
            <div className="pr">€{(p.eurCents / 100).toFixed(0)}</div>
            <div className="lb">{busy === p.id ? '…' : p.label}</div>
          </button>
        ))}
      </div>

      <div className="bx-ledlab">Ledger — onveranderlijk</div>
      {ledger.length === 0 ? (
        <div className="bx-led"><div className="r"><div className="d">Nog geen transacties<small>koop tokens of huur content om te beginnen</small></div></div></div>
      ) : (
        <div className="bx-led">
          {ledger.map((r, i) => {
            const d = describe(r);
            const pos = r.amount_tokens > 0;
            return (
              <div className="r" key={`${r.created_at}-${i}`}>
                <div className="d">{d.title}<small>{d.sub}</small></div>
                <div className={`a ${pos ? 'pos' : 'neg'}`}>{pos ? '+' : ''}{r.amount_tokens}</div>
                <div className="bal">◈ {r.balance_after}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className={`bx-toast ${toast ? 'show' : ''}`}>{toast}</div>
      <BottomNav />
    </div>
  );
}
