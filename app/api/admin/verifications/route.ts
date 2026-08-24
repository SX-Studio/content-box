import { NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { listPendingVerifications } from '@/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reviewer queue of pending identity verifications (operator or moderator).
export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const isReviewer = (await hasRole(account.id, 'platform_operator')) || (await hasRole(account.id, 'moderator'));
  if (!isReviewer) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, verifications: await listPendingVerifications() });
}
