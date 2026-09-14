import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { createBox, listBoxesForAccount } from '@/lib/boxes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// List the boxes the caller can see.
export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const isOperator = await hasRole(account.id, 'platform_operator');
  const boxes = await listBoxesForAccount(account.id, isOperator);
  return NextResponse.json({ ok: true, boxes });
}

// Create a box — platform operators and creators. createBox makes whoever creates it
// the box's first box_admin, so a creator who starts a box owns it: they can invite
// into it and run it without an operator having to set it up for them.
export async function POST(req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  // 'creator' is granted per box, so this asks whether they are a creator ANYWHERE —
  // i.e. an onboarded creator on the platform, not a stranger.
  const canCreate = (await hasRole(account.id, 'platform_operator')) || (await hasRole(account.id, 'creator'));
  if (!canCreate) {
    return NextResponse.json({ ok: false, error: 'Only creators and platform operators can create boxes' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
  const raw = body as { name?: unknown; description?: unknown };

  try {
    const box = await createBox({
      name: String(raw?.name ?? ''),
      description: raw?.description != null ? String(raw.description) : null,
      createdBy: account.id,
    });
    return NextResponse.json({ ok: true, box }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
