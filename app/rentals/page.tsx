'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { boxCss, fmtCountdown, gradOf, ClockIcon, LockIcon, BottomNav } from '@/app/box-ui';

type Rental = {
  public_id: string;
  content_public_id: string;
  title: string;
  creator: string | null;
  expires_at: string;
  preview_url: string | null;
};

export default function MyRentalsPage() {
  const router = useRouter();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const r = await fetch('/api/rentals/my');
    if (r.status === 401) { router.push('/login?next=/rentals'); return; }
    if (r.ok) setRentals((await r.json()).rentals || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const iv = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(iv); }, []);

  async function view(contentId: string) {
    const r = await fetch(`/api/content/${contentId}/view`);
    if (r.ok) { const j = await r.json(); setUrls((u) => ({ ...u, [contentId]: j.url })); }
  }

  if (loading) return <div className="boxui"><style>{boxCss}</style><p className="bx-loading">Loading…</p></div>;

  const active = rentals.filter((r) => new Date(r.expires_at).getTime() > Date.now()).length;

  return (
    <div className="boxui">
      <style>{boxCss}</style>

      <header className="bx-top">
        <div className="bx-badge"><ClockIcon /></div>
        <div className="bx-titles">
          <div className="bx-name">My rentals</div>
          <div className="bx-sub">{active || '—'} actief · jouw tijdelijke library</div>
        </div>
        <a href="/discover" className="bx-chip" title="Discover">◧ Discover</a>
        <a href="/app" className="bx-chip" title="Dashboard">↩ Dashboard</a>
      </header>

      {rentals.length === 0 ? (
        <div className="bx-empty">
          <ClockIcon />
          <div className="h">Nog niets gehuurd</div>
          <p>Open een box of Discover en huur iets — het verschijnt hier met een 24u-timer.</p>
        </div>
      ) : (
        <div className="bx-vhead"><h2>Library</h2><span className="bx-cnt">{active} actief</span></div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {rentals.map((r) => {
          const left = Math.floor((new Date(r.expires_at).getTime() - Date.now()) / 1000);
          const expired = left <= 0;
          const url = urls[r.content_public_id];
          return (
            <div className={`bx-rcard ${expired ? 'expired' : ''}`} key={r.public_id}>
              <div className="bx-rthumb">
                {url
                  ? <img src={url} alt={r.title} className="bx-real" />
                  : r.preview_url
                  ? <div className="bx-ph" style={{ backgroundImage: `url(${r.preview_url})` }} />
                  : <div className="bx-ph" style={{ backgroundImage: gradOf(r.content_public_id) }} />}
              </div>
              <div className="bx-rmeta">
                <div className="t">{r.title}</div>
                <div className="c">Creator {r.creator} · {r.content_public_id}</div>
                {expired
                  ? <div className="bx-timer exp"><LockIcon /> Toegang verlopen</div>
                  : <div className={`bx-timer ${left < 3600 ? 'warn' : ''}`}>◷ {fmtCountdown(r.expires_at)} resterend</div>}
              </div>
              {!expired && (
                <div className="bx-ract">
                  <button className="bx-btn ember" onClick={() => view(r.content_public_id)}>{url ? 'Refresh' : 'Bekijk'}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <BottomNav />
    </div>
  );
}
