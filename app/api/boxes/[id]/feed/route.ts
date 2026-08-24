import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';
import { publicUrl } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The box feed: approved content with blurred previews (never the master). Gated to
// box members and platform operators.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { data: box } = await admin().from('box').select('id').eq('public_id', params.id).maybeSingle();
  if (!box) return NextResponse.json({ ok: false, error: 'Box not found' }, { status: 404 });
  const boxId = (box as { id: string }).id;

  if (!(await hasRole(account.id, 'platform_operator'))) {
    const { data: membership } = await admin()
      .from('box_membership')
      .select('id')
      .eq('box_id', boxId)
      .eq('account_id', account.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership) return NextResponse.json({ ok: false, error: 'Not a member of this box' }, { status: 403 });
  }

  const { data } = await admin()
    .from('content')
    .select('public_id, title, description, price_tokens, created_at, creator:creator_id ( public_id ), assets:content_asset ( preview_path, thumb_path, kind, position )')
    .eq('box_id', boxId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(60);

  const feed = ((data ?? []) as unknown as {
    public_id: string;
    title: string;
    description: string | null;
    price_tokens: number;
    created_at: string;
    creator: { public_id: string } | null;
    assets: { preview_path: string | null; thumb_path: string | null; kind: string | null; position: number }[];
  }[]).map((c) => {
    const asset = [...(c.assets ?? [])].sort((a, b) => a.position - b.position)[0];
    return {
      public_id: c.public_id,
      title: c.title,
      description: c.description,
      price_tokens: c.price_tokens,
      created_at: c.created_at,
      creator: c.creator?.public_id ?? null,
      is_owner: c.creator?.public_id === account.public_id,
      asset_count: c.assets?.length ?? 0,
      media_type: asset?.kind === 'video' ? 'video' : 'image',
      preview_url: asset?.preview_path ? publicUrl('preview', asset.preview_path) : null,
    };
  });

  return NextResponse.json({ ok: true, feed });
}
