'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { boxCss, BottomNav } from '@/app/box-ui';
import { PACKAGES } from '@/lib/packages';
import { useT, LocaleSwitcher } from '@/app/i18n-provider';
import type { T } from '@/lib/i18n';

type LedgerRow = {
  type: string;
  amount_tokens: number;
  ref_type: string | null;
  ref_id: string | null;
  balance_after: number;
  created_at: string;
};

// Friendly label for a ledger row from its type + refs.
function describe(r: LedgerRow, t: T): { title: string; sub: string } {
  const kind = r.type.toLowerCase();
  if (kind === 'topup') return { title: t('wallet.topUp'), sub: r.ref_type === 'dev_topup' ? t('wallet.devTopUp') : t('wallet.topUpSub') };
  if (kind === 'purchase') return { title: t('wallet.tokenPurchase'), sub: `${t('wallet.viaProvider')}${r.ref_id ? ' · ' + r.ref_id : ''}` };
  if (kind === 'rent' || kind === 'rental' || kind === 'spend') return { title: `${t('wallet.rental')}${r.ref_id ? ' · ' + r.ref_id : ''}`, sub: t('wallet.accessHours', { hours: 24 }) };
  if (kind === 'payout' || kind === 'earning' || kind === 'earn') return { title: t('wallet.creatorEarning'), sub: r.ref_id || t('wallet.payout') };
  return { title: r.type, sub: [r.ref_type, r.ref_id].filter(Boolean).join(' · ') };
}

export default function WalletPage() {
  const router = useRouter();
  const t = useT();
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

  // Buy a package. Every built rail is tried in turn — card first, then crypto —
  // because each answers { configured:false } when its env vars are unset, and only
  // one of them needs to be live for a user to be able to top up. Previously only
  // Verotel was attempted, so the two working rails behind it were unreachable and
  // an unconfigured Verotel dead-ended on the dev top-up.
  const RAILS: { path: string; label: string }[] = [
    { path: '/api/wallet/purchase', label: 'card' },
    { path: '/api/wallet/purchase-crypto', label: 'crypto' },
  ];

  async function buy(pkgId: string, tokens: number) {
    if (busy) return;
    setBusy(pkgId);
    try {
      for (const rail of RAILS) {
        const r = await fetch(rail.path, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageId: pkgId }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.url) { window.location.href = j.url; return; }
        if (r.ok && j.configured === false) continue; // rail not set up — try the next
        flash(j.error || t('wallet.purchaseFailed', { rail: rail.label }));
        return;
      }

      // No payment rail is configured. The dev top-up only answers in stub mode; in
      // production it 403s, so say what is actually true rather than pointing at a
      // store that does not exist.
      const dev = await fetch('/api/wallet/topup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: tokens }),
      });
      if (dev.ok) { await load(); flash(t('wallet.devTopUpAdded', { tokens })); return; }
      flash(t('wallet.noPaymentMethod'));
    } catch (e) { flash((e as Error).message); } finally { setBusy(null); }
  }

  if (loading) return <div className="boxui"><style>{boxCss}</style><p className="bx-loading">{t('common.loading')}</p></div>;

  const eur = ((balance ?? 0) / 100).toFixed(2);

  return (
    <div className="boxui">
      <style>{boxCss}</style>

      <header className="bx-top">
        <div className="bx-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" /></svg>
        </div>
        <div className="bx-titles">
          <div className="bx-name">{t('wallet.title')}</div>
          <div className="bx-sub">{t('wallet.subtitle')}</div>
        </div>
        <a href="/discover" className="bx-chip" title={t('nav.discover')}>◧ {t('nav.discover')}</a>
        <a href="/app" className="bx-chip" title={t('nav.dashboard')}>↩ {t('nav.dashboard')}</a>
        <LocaleSwitcher compact />
      </header>

      <div className="bx-balcard">
        <div className="lab">{t('wallet.userWallet')}{accountId ? ` · ${accountId}` : ''}</div>
        <div className="big">{balance ?? 0} <span>{t('wallet.tokens')}</span></div>
        <div className="eur">≈ €{eur} · {t('wallet.rate')}</div>
      </div>

      <div className="bx-ledlab">{t('wallet.buyTokens')}</div>
      <div className="bx-pkgs">
        {PACKAGES.map((p) => (
          <button key={p.id} className="bx-pkg" disabled={!!busy} onClick={() => buy(p.id, p.tokens)}>
            <div className="tk">◈ {p.tokens}</div>
            <div className="pr">€{(p.eurCents / 100).toFixed(0)}</div>
            <div className="lb">{busy === p.id ? '…' : p.label}</div>
          </button>
        ))}
      </div>

      <div className="bx-ledlab">{t('wallet.ledger')}</div>
      {ledger.length === 0 ? (
        <div className="bx-led"><div className="r"><div className="d">{t('wallet.noTransactions')}<small>{t('wallet.emptyHint')}</small></div></div></div>
      ) : (
        <div className="bx-led">
          {ledger.map((r, i) => {
            const d = describe(r, t);
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
