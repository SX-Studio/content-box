import { NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Every box with what it holds, for the moderation console's Boxes tab.
//
// PLATFORM OPERATORS ONLY — deliberately stricter than the rest of this console, which
// is moderator-gated. Moderators judge content; removing a box is structural, and a box
// carries other people's paid rentals with it.
export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!(await hasRole(account.id, 'platform_operator'))) {
    return NextResponse.json({ ok: false, error: 'Platform operators only' }, { status: 403 });
  }

  const { data } = await admin()
    .from('box')
    .select('id, public_id, name, status, created_at')
    .order('created_at', { ascending: false });
  const boxes = (data ?? []) as { id: string; public_id: string; name: string; status: string; created_at: string }[];
  if (!boxes.length) return NextResponse.json({ ok: true, boxes: [] });

  const ids = boxes.map((b) => b.id);
  const [{ data: content }, { data: rentals }] = await Promise.all([
    admin().from('content').select('box_id').in('box_id', ids),
    admin().from('rental').select('box_id').in('box_id', ids),
  ]);
  const tally = (rows: { box_id: string }[] | null) => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) m[r.box_id] = (m[r.box_id] ?? 0) + 1;
    return m;
  };
  const c = tally(content as { box_id: string }[] | null);
  const r = tally(rentals as { box_id: string }[] | null);

  return NextResponse.json({
    ok: true,
    boxes: boxes.map((b) => ({
      public_id: b.public_id,
      name: b.name,
      status: b.status,
      created_at: b.created_at,
      contentCount: c[b.id] ?? 0,
      rentalCount: r[b.id] ?? 0,
    })),
  });
}
