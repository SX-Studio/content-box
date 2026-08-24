import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { decideVerification } from '@/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reviewer decision on an identity verification (operator or moderator).
export async function POST(req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const isReviewer = (await hasRole(account.id, 'platform_operator')) || (await hasRole(account.id, 'moderator'));
  if (!isReviewer) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  const { id, approve, reason } = (await req.json().catch(() => ({}))) as { id?: string; approve?: boolean; reason?: string };
  if (!id || typeof approve !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'id and approve are required' }, { status: 400 });
  }
  try {
    await decideVerification(id, account.id, approve, reason?.trim() || null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
