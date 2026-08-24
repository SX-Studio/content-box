import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';
import { publicUrl } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cross-box discover feed: approved content from every box the member belongs to,
// newest first, in one stream. Operators see all boxes. Blurred previews only —
// the master is still gated behind a rental via /api/content/[id]/view.
export async function GET(_req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const isOperator = await hasRole(account.id, 'platform_operator');

  let boxIds: string[] | null = null; // null = all (operator)
  if (!isOperator) {
    const { data: memberships } = await admin()
      .from('box_membership')
      .select('box_id')
      .eq('account_id', account.id)
      .eq('status', 'active');
    boxIds = ((memberships ?? []) as { box_id: string }[]).map((m) => m.box_id);
    if (boxIds.length === 0) return NextResponse.json({ ok: true, feed: [] });
  }

  let query = admin()
    .from('content')
    .select('public_id, title, description, price_tokens, created_at, box:box_id ( public_id, name ), creator:creator_id ( public_id ), assets:content_asset ( preview_path, kind, position )')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(80);
  if (boxIds) query = query.in('box_id', boxIds);

  const { data } = await query;

  const feed = ((data ?? []) as unknown as {
    public_id: string;
    title: string;
    description: string | null;
    price_tokens: number;
    created_at: string;
    box: { public_id: string; name: string } | null;
    creator: { public_id: string } | null;
    assets: { preview_path: string | null; kind: string | null; position: number }[];
  }[]).map((c) => {
    const asset = [...(c.assets ?? [])].sort((a, b) => a.position - b.position)[0];
    return {
      public_id: c.public_id,
      title: c.title,
      price_tokens: c.price_tokens,
      creator: c.creator?.public_id ?? null,
      is_owner: c.creator?.public_id === account.public_id,
      box_name: c.box?.name ?? '',
      box_public_id: c.box?.public_id ?? '',
      media_type: asset?.kind === 'video' ? 'video' : 'image',
      preview_url: asset?.preview_path ? publicUrl('preview', asset.preview_path) : null,
    };
  });

  return NextResponse.json({ ok: true, feed });
}
