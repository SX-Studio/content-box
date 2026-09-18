import { requireAdminStepUp } from '@/lib/admin-stepup';
import { admin } from '@/lib/supabase/admin';
import AdminConsole, { type Overview, type AuditRow } from './AdminConsole';
import { type BoxStat } from './AdminBoxes';

export const dynamic = 'force-dynamic';

const n = (v: unknown) => Number(v ?? 0);

function clock(iso: string): string {
  const d = new Date(iso);
  const p = (x: number) => (x < 10 ? '0' : '') + x;
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default async function AdminDashboard() {
  // Operators only (moderators get /moderation instead) + fingerprint step-up.
  const account = await requireAdminStepUp();

  const [{ data: ps }, { data: bs }, { data: al }] = await Promise.all([
    admin().from('platform_stats').select('*').maybeSingle(),
    admin().from('box_stats').select('*').order('name'),
    admin().from('audit_log').select('actor_id, action, target_type, target_id, metadata, created_at').order('created_at', { ascending: false }).limit(40),
  ]);

  const s = (ps ?? {}) as Record<string, unknown>;
  const overview: Overview = {
    accounts: n(s.accounts), boxes: n(s.boxes), content: n(s.content), drops_last_hour: n(s.drops_last_hour),
    active_rentals: n(s.active_rentals), open_reports: n(s.open_reports),
    tokens_in_circulation: n(s.tokens_in_circulation), creator_tokens: n(s.creator_tokens), platform_tokens: n(s.platform_tokens),
  };

  const boxes: BoxStat[] = (bs ?? []).map((b) => ({
    box_id: String(b.box_id), public_id: String(b.public_id), name: String(b.name), status: String(b.status),
    users: n(b.users), drops: n(b.drops), rentals: n(b.rentals),
    tokens_in: n(b.tokens_in), creator_tokens: n(b.creator_tokens), platform_tokens: n(b.platform_tokens),
  }));

  const audit: AuditRow[] = (al ?? []).map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const metaStr = Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(' · ');
    return {
      ts: clock(String(r.created_at)),
      actor: r.actor_id ? String(r.actor_id).slice(0, 8) : 'system',
      action: String(r.action),
      target: [r.target_type, r.target_id].filter(Boolean).join(' '),
      meta: metaStr,
    };
  });

  return <AdminConsole account={{ public_id: account.public_id }} overview={overview} boxes={boxes} audit={audit} />;
}
