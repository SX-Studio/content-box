'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { boxCss, fmtCountdown, gradOf, ClockIcon, LockIcon, BottomNav } from '@/app/box-ui';
import { useT, LocaleSwitcher } from '@/app/i18n-provider';

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
  const t = useT();
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

  if (loading) return <div className="boxui"><style>{boxCss}</style><p className="bx-loading">{t('common.loading')}</p></div>;

  const active = rentals.filter((r) => new Date(r.expires_at).getTime() > Date.now()).length;

  return (
    <div className="boxui">
      <style>{boxCss}</style>

      <header className="bx-top">
        <div className="bx-badge"><ClockIcon /></div>
        <div className="bx-titles">
          <div className="bx-name">{t('rentals.title')}</div>
          <div className="bx-sub">{t('rentals.subtitle', { count: active || '—' })}</div>
        </div>
        <a href="/discover" className="bx-chip" title={t('nav.discover')}>◧ {t('nav.discover')}</a>
        <a href="/app" className="bx-chip" title={t('nav.dashboard')}>↩ {t('nav.dashboard')}</a>
        <LocaleSwitcher compact />
      </header>

      {rentals.length === 0 ? (
        <div className="bx-empty">
          <ClockIcon />
          <div className="h">{t('rentals.emptyTitle')}</div>
          <p>{t('rentals.emptyBody')}</p>
        </div>
      ) : (
        <div className="bx-vhead"><h2>{t('rentals.library')}</h2><span className="bx-cnt">{t('rentals.activeCount', { count: active })}</span></div>
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
                <div className="c">{t('rentals.creator')} {r.creator} · {r.content_public_id}</div>
                {expired
                  ? <div className="bx-timer exp"><LockIcon /> {t('rentals.expired')}</div>
                  : <div className={`bx-timer ${left < 3600 ? 'warn' : ''}`}>◷ {t('rentals.remaining', { time: fmtCountdown(r.expires_at) })}</div>}
              </div>
              {!expired && (
                <div className="bx-ract">
                  <button className="bx-btn ember" onClick={() => view(r.content_public_id)}>{url ? t('rentals.refresh') : t('rentals.view')}</button>
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
