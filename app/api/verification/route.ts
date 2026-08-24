import { NextRequest, NextResponse } from 'next/server';
import { currentAccount } from '@/lib/authz';
import { submitVerification, getMyVerification, ID_MAX_BYTES } from '@/lib/identity';
import { ALLOWED_IMAGE_MIME } from '@/lib/content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Creator's own verification status.
export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json({ ok: true, verification: await getMyVerification(account.id) });
}

// Submit (or resubmit) identity verification: ID document (+ optional selfie),
// name, DOB, document type, consent. Files go straight to the private bucket.
export async function POST(req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid form data' }, { status: 400 });
  }

  const document = form.get('document');
  if (!(document instanceof File)) return NextResponse.json({ ok: false, error: 'An ID document image is required' }, { status: 400 });
  const selfie = form.get('selfie');

  async function readImage(file: File, label: string): Promise<{ buffer: Buffer; mime: string }> {
    if (!ALLOWED_IMAGE_MIME.includes(file.type)) throw new Error(`${label} must be a JPEG, PNG or WebP image`);
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.byteLength > ID_MAX_BYTES) throw new Error(`${label} is too large (max 2MB)`);
    return { buffer: buf, mime: file.type };
  }

  try {
    const doc = await readImage(document, 'The ID document');
    const self = selfie instanceof File ? await readImage(selfie, 'The selfie') : null;
    await submitVerification(account.id, account.public_id, {
      fullName: String(form.get('fullName') ?? ''),
      dob: String(form.get('dob') ?? ''),
      country: form.get('country') ? String(form.get('country')).trim() : null,
      documentType: String(form.get('documentType') ?? ''),
      consent: String(form.get('consent') ?? '') === 'true',
      document: doc,
      selfie: self,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: 'pending' });
}
