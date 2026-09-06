'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { boxCss, FeedCard, PhotoIcon, type FeedItem } from '@/app/box-ui';

export default function DiscoverPage() {
  const router = useRouter();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [rented, setRented] = useState<Record<string, string>>({});
  const [box, setBox] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [renting, setRenting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast((t) => (t === m ? null : t)), 2400); }, []);

  const loadWallet = useCallback(async () => {
    const w = await fetch('/api/wallet');
    if (w.ok) setBalance((await w.json()).balance ?? null);
  }, []);

  const load = useCallback(async () => {
    const [f, m] = await Promise.all([fetch('/api/discover'), fetch('/api/rentals/my')]);
    if (f.status === 401) { router.push('/login?next=/discover'); return; }
    if (f.ok) setFeed((await f.json()).feed || []);
    if (m.ok) {
      const map: Record<string, string> = {};
      for (const r of (await m.json()).rentals || []) map[r.content_public_id] = r.expires_at;
      setRented(map);
    }
    await loadWallet();
    setLoading(false);
  }, [router, loadWallet]);
  useEffect(() => { load(); }, [load]);

  const isRentedNow = useCallback((id: string) => {
    const e = rented[id];
    return !!e && new Date(e).getTime() > Date.now();
  }, [rented]);

  const toggle = useCallback((id: string) => setSelected((s) => ({ ...s, [id]: !s[id] })), []);

  const rent = useCallback(async (ids: string[]) => {
    if (!ids.length || renting) return;
    setRenting(true);
    let ok = 0; let failMsg: string | null = null;
    for (const id of ids) {
      try {
        const r = await fetch(`/api/content/${id}/rent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idempotencyKey: `${id}:${Date.now()}` }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Could not rent');
        setRented((m) => ({ ...m, [id]: j.expiresAt }));
        setSelected((s) => { const n = { ...s }; delete n[id]; return n; });
        ok++;
      } catch (e) { failMsg = (e as Error).message; break; }
    }
    await loadWallet();
    setRenting(false);
    if (ok) flash(ok > 1 ? `${ok} items gehuurd · 24u toegang` : 'Gehuurd · 24u toegang actief');
    if (failMsg) flash(failMsg);
  }, [renting, loadWallet, flash]);

  if (loading) return <div className="boxui"><style>{boxCss}</style><p className="bx-loading">Loading…</p></div>;

  const boxes = Array.from(new Map(feed.map((i) => [i.box_public_id, i.box_name])).entries());
  const shown = box === 'all' ? feed : feed.filter((i) => i.box_public_id === box);
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const cartTotal = selectedIds.reduce((s, id) => s + (feed.find((f) => f.public_id === id)?.price_tokens || 0), 0);

  return (
    <div className="boxui">
      <style>{boxCss}</style>

      <header className="bx-top">
        <div className="bx-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
        </div>
        <div className="bx-titles">
          <div className="bx-name">Discover</div>
          <div className="bx-sub">één feed · alle boxen die je volgt</div>
        </div>
        <a href="/rentals" className="bx-chip" title="My rentals">◷ Rentals</a>
        <a href="/app" className="bx-chip" title="Dashboard">↩ Dashboard</a>
        <a href="/wallet" className="bx-chip wallet" title="Wallet">◈ {balance ?? '—'}</a>
      </header>

      {boxes.length > 1 && (
        <div className="bx-pills">
          <button className={`bx-pill ${box === 'all' ? 'on' : ''}`} onClick={() => setBox('all')}>Alle</button>
          {boxes.map(([id, name]) => (
            <button key={id} className={`bx-pill ${box === id ? 'on' : ''}`} onClick={() => setBox(id!)}>{name}</button>
          ))}
        </div>
      )}

      <div className="bx-vhead">
        <h2>Nieuwste drops</h2>
        <span className="bx-cnt">{shown.length} drop{shown.length === 1 ? '' : 's'}</span>
      </div>

      {shown.length === 0 ? (
        <div className="bx-empty">
          <PhotoIcon />
          <div className="h">Nog niets hier</div>
          <p>Word lid van een box of kom binnenkort terug.</p>
        </div>
      ) : (
        <div className="bx-grid">
          {shown.map((c) => (
            <FeedCard
              key={c.public_id}
              item={c}
              expiry={rented[c.public_id] || null}
              rentedNow={isRentedNow(c.public_id)}
              selected={!!selected[c.public_id]}
              onToggle={() => toggle(c.public_id)}
              onRent={() => rent([c.public_id])}
              renting={renting}
              onReported={() => flash('Gerapporteerd — bedankt. Ons team bekijkt het.')}
              showBox
              showReport
            />
          ))}
        </div>
      )}

      <div className={`bx-cart ${selectedIds.length ? 'show' : ''}`}>
        <div className="info">Rent selected<b>{cartTotal} tokens</b></div>
        <div className="cnt">{selectedIds.length} item{selectedIds.length === 1 ? '' : 's'}</div>
        <button className="bx-btn ember" disabled={renting} onClick={() => rent(selectedIds)}>{renting ? '…' : 'Rent 24u'}</button>
      </div>

      <div className={`bx-toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}
