import { NextRequest, NextResponse } from 'next/server';
import { currentAccount } from '@/lib/authz';
import { viewContent } from '@/lib/rentals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns a short-lived signed URL for the master ONLY if the caller has an active,
// unexpired rental. This re-check on every view is the real access lock.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const urls = await viewContent(account.id, params.id);
  if (!urls) return NextResponse.json({ ok: false, error: 'No active rental for this content' }, { status: 403 });
  // `url` stays in the response as the first asset so existing callers keep working;
  // `urls` carries every photo for multi-photo items.
  return NextResponse.json({ ok: true, url: urls[0], urls });
}
