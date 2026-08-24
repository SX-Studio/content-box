import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';
import { validateContentInput, ALLOWED_IMAGE_MIME, MAX_UPLOAD_BYTES, extForMime } from '@/lib/content';
import { processImage } from '@/lib/media';
import { uploadObject, publicUrl } from '@/lib/storage';
import { publicId } from '@/lib/ids';
import { writeAudit } from '@/lib/audit';
import { emit } from '@/lib/events';
import { screenImage, createModerationCase } from '@/lib/moderation';
import { isAgeVerified } from '@/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Upload an image into a box. Creators (or box admins/operators) only. Stores the
// private master, generates + stores blurred preview and thumbnail, records the row.
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
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'A file is required' }, { status: 400 });

  const { data: box } = await admin().from('box').select('id').eq('public_id', boxPublicId).maybeSingle();
  if (!box) return NextResponse.json({ ok: false, error: 'Box not found' }, { status: 404 });
  const boxId = (box as { id: string }).id;

  const allowed =
    (await hasRole(account.id, 'platform_operator')) ||
    (await hasRole(account.id, 'creator', boxId)) ||
    (await hasRole(account.id, 'box_admin', boxId));
  if (!allowed) return NextResponse.json({ ok: false, error: 'You must be a creator in this box to upload' }, { status: 403 });

  // 18+/ID gate: operators are exempt; every other uploader must be verified.
  const isOperator = await hasRole(account.id, 'platform_operator');
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

  const mime = file.type;
  if (!ALLOWED_IMAGE_MIME.includes(mime)) {
    return NextResponse.json({ ok: false, error: 'Only JPEG, PNG or WebP images are supported (Phase 2)' }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: 'Image too large (max 15MB)' }, { status: 413 });
  }

  let processed;
  try {
    processed = await processImage(buf);
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not read that image' }, { status: 400 });
  }

  // AI safety screen (stub). Low risk auto-approves; anything else waits for a human.
  const screen = await screenImage(buf, mime);
  const autoApprove = screen.riskLevel === 'low';

  const description = form.get('description') ? String(form.get('description')).trim() : null;
  const { data: content, error: cErr } = await admin()
    .from('content')
    .insert({ public_id: publicId('CNT'), box_id: boxId, creator_id: account.id, title, description, price_tokens: price, status: autoApprove ? 'approved' : 'pending' })
    .select('id, public_id')
    .single();
  if (cErr || !content) return NextResponse.json({ ok: false, error: 'Could not save content' }, { status: 500 });

  const base = `${boxId}/${content.id}`;
  const ext = extForMime(mime);
  try {
    await uploadObject('master', `${base}/master.${ext}`, buf, mime);
    await uploadObject('preview', `${base}/blur.jpg`, processed.blurred, 'image/jpeg');
    await uploadObject('preview', `${base}/thumb.jpg`, processed.thumb, 'image/jpeg');
  } catch (e) {
    await admin().from('content').delete().eq('id', content.id);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }

  await admin().from('content_asset').insert({
    content_id: content.id,
    kind: 'image',
    storage_path: `${base}/master.${ext}`,
    preview_path: `${base}/blur.jpg`,
    thumb_path: `${base}/thumb.jpg`,
    mime,
    bytes: buf.byteLength,
    width: processed.width,
    height: processed.height,
    position: 0,
  });

  await createModerationCase(content.id, screen, autoApprove);
  await writeAudit({ actorId: account.id, action: 'content.uploaded', targetType: 'content', targetId: content.public_id, metadata: { box_id: boxId, risk: screen.riskLevel } });
  await emit('CONTENT_UPLOADED', { content_id: content.id, box_id: boxId });
  if (autoApprove) await emit('CONTENT_APPROVED', { content_id: content.id });

  return NextResponse.json(
    { ok: true, content: { public_id: content.public_id, status: autoApprove ? 'approved' : 'pending', preview_url: publicUrl('preview', `${base}/blur.jpg`) } },
    { status: 201 }
  );
}
