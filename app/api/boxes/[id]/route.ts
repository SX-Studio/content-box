import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { getBoxForAccount, renameBox, removeBox } from '@/lib/boxes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Box detail by public id (BOX-…). Gated to members, or any platform operator.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const isOperator = await hasRole(account.id, 'platform_operator');
  const box = await getBoxForAccount(params.id, account.id, isOperator);
  if (!box) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, box });
}

// Rename a box — App Admin (platform operator) or a box admin of this box.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const isOperator = await hasRole(account.id, 'platform_operator');
  const box = await getBoxForAccount(params.id, account.id, isOperator);
  if (!box) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (!isOperator && box.role !== 'box_admin') {
    return NextResponse.json({ ok: false, error: 'Only box admins or platform operators can rename a box' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
  const name = String((body as { name?: unknown })?.name ?? '');

  try {
    const updated = await renameBox({ boxPublicId: params.id, name, actorId: account.id });
    return NextResponse.json({ ok: true, box: updated });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

// Remove a box. PLATFORM OPERATORS ONLY.
//
// This is not a plain DELETE. box(id) cascades to content, rental, box_membership and
// invitation — and a rental is a paid 24h entitlement, so hard-deleting a box with any
// history destroys access somebody bought and the record of what they bought, while the
// ledger debit that paid for it survives. So removeBox() hard-deletes ONLY a box that
// has never held content and never had a rental; anything else archives, which is
// reversible via /restore. The response says which happened and why.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!(await hasRole(account.id, 'platform_operator'))) {
    return NextResponse.json({ ok: false, error: 'Platform operators only' }, { status: 403 });
  }
  try {
    const r = await removeBox({ boxPublicId: params.id, actorId: account.id });
    return NextResponse.json({
      ok: true,
      mode: r.mode,
      contentCount: r.contentCount,
      rentalCount: r.rentalCount,
      box: { public_id: r.box.public_id, name: r.box.name },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
