import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';
import { createInvitation } from '@/lib/invitations';
import { getSender } from '@/lib/auth/sender';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Invite a phone number into this box as box_admin, creator or user. Box admins (of
// this box) or platform operators only.
//
// Appointing a box admin is reserved to platform operators. A box admin invites
// creators and users only. The granted role always carries box_id, so it is scoped to
// that box and is never platform_operator or moderator.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { data: box } = await admin().from('box').select('id, public_id, status').eq('public_id', params.id).maybeSingle();
  if (!box) return NextResponse.json({ ok: false, error: 'Box not found' }, { status: 404 });

  const isOperator = await hasRole(account.id, 'platform_operator');
  const allowed = isOperator || (await hasRole(account.id, 'box_admin', (box as { id: string }).id));
  if (!allowed) return NextResponse.json({ ok: false, error: 'Only box admins can invite' }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
  const raw = body as { phone?: unknown; role?: unknown };
  const role = String(raw?.role ?? '');
  if (role !== 'box_admin' && role !== 'creator' && role !== 'user') {
    return NextResponse.json({ ok: false, error: 'Role must be box_admin, creator or user' }, { status: 400 });
  }
  // Making someone a box admin is a PLATFORM OPERATOR action. A box admin can invite
  // creators and users into their box, but cannot appoint another admin — otherwise
  // one compromised or careless admin quietly multiplies into several, and the
  // operators lose the ability to say who runs a box.
  if (role === 'box_admin' && !isOperator) {
    return NextResponse.json(
      { ok: false, error: 'Only platform operators can make someone a box admin' },
      { status: 403 },
    );
  }

  try {
    const { invitation, token } = await createInvitation({
      boxId: (box as { id: string }).id,
      targetPhone: String(raw?.phone ?? ''),
      targetRole: role,
      invitedBy: account.id,
    });
    // Deliver the invite link over SMS (stub logs it in Phase 1).
    const link = `/invite/${token}`;
    await getSender().send(String(raw?.phone ?? ''), `Join on Content Box: ${link}`);

    const payload: Record<string, unknown> = {
      ok: true,
      invitation: { public_id: invitation.public_id, target_role: invitation.target_role, expires_at: invitation.expires_at },
    };
    // Dev convenience only: expose the link while the sender is the console stub.
    if (env.otpSender() === 'stub') payload.dev = { token, link };
    return NextResponse.json(payload, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
