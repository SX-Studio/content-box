import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';
import { createUploadUrl } from '@/lib/storage';
import { ALLOWED_VIDEO_MIME, extForVideoMime } from '@/lib/content';
import { isAgeVerified } from '@/lib/identity';
import { publicId } from '@/lib/ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Issue a one-time signed URL so the client can upload a video straight to the
// private master bucket. Same gates as content upload (creator in box + 18+).
export async function POST(req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { boxId, contentType } = (await req.json().catch(() => ({}))) as { boxId?: string; contentType?: string };
  if (!boxId || !contentType) return NextResponse.json({ ok: false, error: 'boxId and contentType are required' }, { status: 400 });
  if (!ALLOWED_VIDEO_MIME.includes(contentType)) {
    return NextResponse.json({ ok: false, error: 'Only MP4, WebM or MOV video is supported' }, { status: 400 });
  }

  const { data: box } = await admin().from('box').select('id').eq('public_id', boxId).maybeSingle();
  if (!box) return NextResponse.json({ ok: false, error: 'Box not found' }, { status: 404 });
  const bid = (box as { id: string }).id;

  const isOperator = await hasRole(account.id, 'platform_operator');
  const allowed = isOperator || (await hasRole(account.id, 'creator', bid)) || (await hasRole(account.id, 'box_admin', bid));
  if (!allowed) return NextResponse.json({ ok: false, error: 'You must be a creator in this box to upload' }, { status: 403 });
  if (!isOperator && !(await isAgeVerified(account.id))) {
    return NextResponse.json({ ok: false, error: 'Verify your identity (18+) before publishing content', code: 'AGE_VERIFICATION_REQUIRED' }, { status: 403 });
  }

  const path = `${bid}/video/${publicId('CNT')}.${extForVideoMime(contentType)}`;
  try {
    const { uploadUrl } = await createUploadUrl('master', path);
    return NextResponse.json({ ok: true, uploadUrl, path });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
