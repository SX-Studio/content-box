import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';
import {
  validateContentInput, ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME, MAX_UPLOAD_BYTES, extForMime,
} from '@/lib/content';
import { processImage } from '@/lib/media';
import { uploadObject, publicUrl, objectExists } from '@/lib/storage';
import { publicId } from '@/lib/ids';
import { writeAudit } from '@/lib/audit';
import { emit } from '@/lib/events';
import { screenImage, createModerationCase } from '@/lib/moderation';
import { isAgeVerified } from '@/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Publish content into a box. Creators (or box admins/operators) only, and only once
// 18+/ID-verified. Images upload through here; video is uploaded to storage directly
// and posted here with a poster image that becomes the blurred preview/thumbnail.
export async function POST(req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid form data' }, { status: 400 });
  }

  const boxPublicId = String(form.get('boxId') ?? '');
  const { data: box } = await admin().from('box').select('id').eq('public_id', boxPublicId).maybeSingle();
  if (!box) return NextResponse.json({ ok: false, error: 'Box not found' }, { status: 404 });
  const boxId = (box as { id: string }).id;

  const isOperator = await hasRole(account.id, 'platform_operator');
  const allowed = isOperator || (await hasRole(account.id, 'creator', boxId)) || (await hasRole(account.id, 'box_admin', boxId));
  if (!allowed) return NextResponse.json({ ok: false, error: 'You must be a creator in this box to upload' }, { status: 403 });
  if (!isOperator && !(await isAgeVerified(account.id))) {
    return NextResponse.json({ ok: false, error: 'Verify your identity (18+) before publishing content', code: 'AGE_VERIFICATION_REQUIRED' }, { status: 403 });
  }

  let title: string;
  let price: number;
  try {
    ({ title, price } = validateContentInput(String(form.get('title') ?? ''), form.get('price')));
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
  const description = form.get('description') ? String(form.get('description')).trim() : null;

  const videoPath = form.get('videoPath') ? String(form.get('videoPath')) : '';
  const isVideo = videoPath.length > 0;

  // The poster (video) or the image itself is what we screen + derive previews from.
  const posterFile = isVideo ? form.get('poster') : form.get('file');
  if (!(posterFile instanceof File)) {
    return NextResponse.json({ ok: false, error: isVideo ? 'A poster image is required' : 'A file is required' }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_MIME.includes(posterFile.type)) {
    return NextResponse.json({ ok: false, error: `${isVideo ? 'Poster' : 'Image'} must be JPEG, PNG or WebP` }, { status: 400 });
  }
  const posterBuf = Buffer.from(await posterFile.arrayBuffer());
  if (posterBuf.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: 'Image too large (max 15MB)' }, { status: 413 });
  }

  // Video-specific validation: the master must already sit under this box's prefix.
  let videoMime = '';
  if (isVideo) {
    videoMime = String(form.get('videoMime') ?? '');
    if (!ALLOWED_VIDEO_MIME.includes(videoMime)) {
      return NextResponse.json({ ok: false, error: 'Unsupported video type' }, { status: 400 });
    }
    if (!videoPath.startsWith(`${boxId}/`) || videoPath.includes('..')) {
      return NextResponse.json({ ok: false, error: 'Invalid video reference' }, { status: 400 });
    }
    if (!(await objectExists('master', videoPath))) {
      return NextResponse.json({ ok: false, error: 'Video upload not found — please retry' }, { status: 400 });
    }
  }

  let processed;
  try {
    processed = await processImage(posterBuf);
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not read that image' }, { status: 400 });
  }

  // AI safety screen runs on the poster/image. Low risk auto-approves.
  const screen = await screenImage(posterBuf, posterFile.type);
  const autoApprove = screen.riskLevel === 'low';

  const { data: content, error: cErr } = await admin()
    .from('content')
    .insert({ public_id: publicId('CNT'), box_id: boxId, creator_id: account.id, title, description, price_tokens: price, status: autoApprove ? 'approved' : 'pending' })
    .select('id, public_id')
    .single();
  if (cErr || !content) return NextResponse.json({ ok: false, error: 'Could not save content' }, { status: 500 });

  const base = `${boxId}/${content.id}`;
  const masterPath = isVideo ? videoPath : `${base}/master.${extForMime(posterFile.type)}`;
  try {
    if (!isVideo) await uploadObject('master', masterPath, posterBuf, posterFile.type);
    await uploadObject('preview', `${base}/blur.jpg`, processed.blurred, 'image/jpeg');
    await uploadObject('preview', `${base}/thumb.jpg`, processed.thumb, 'image/jpeg');
  } catch (e) {
    await admin().from('content').delete().eq('id', content.id);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }

  await admin().from('content_asset').insert({
    content_id: content.id,
    kind: isVideo ? 'video' : 'image',
    storage_path: masterPath,
    preview_path: `${base}/blur.jpg`,
    thumb_path: `${base}/thumb.jpg`,
    mime: isVideo ? videoMime : posterFile.type,
    bytes: isVideo ? null : posterBuf.byteLength,
    width: processed.width,
    height: processed.height,
    position: 0,
  });

  await createModerationCase(content.id, screen, autoApprove);
  await writeAudit({ actorId: account.id, action: 'content.uploaded', targetType: 'content', targetId: content.public_id, metadata: { box_id: boxId, kind: isVideo ? 'video' : 'image', risk: screen.riskLevel } });
  await emit('CONTENT_UPLOADED', { content_id: content.id, box_id: boxId });
  if (autoApprove) await emit('CONTENT_APPROVED', { content_id: content.id });

  return NextResponse.json(
    { ok: true, content: { public_id: content.public_id, status: autoApprove ? 'approved' : 'pending', preview_url: publicUrl('preview', `${base}/blur.jpg`) } },
    { status: 201 },
  );
}
