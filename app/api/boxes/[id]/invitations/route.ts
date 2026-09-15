import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';
import { createInvitation } from '@/lib/invitations';
import { sendSmsChecked, smsConfigured } from '@/lib/sms';
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
  const raw = body as { phone?: unknown; role?: unknown; sendSms?: unknown };
  const role = String(raw?.role ?? '');
  if (role !== 'box_admin' && role !== 'creator' && role !== 'user') {
    return NextResponse.json({ ok: false, error: 'Role must be box_admin, creator or user' }, { status: 400 });
  }
  // SMS is opt-in: link-only is the default, so invites do not depend on a working
  // SMS provider (and cost nothing to issue).
  const wantsSms = raw?.sendSms === true;

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
    // Absolute URL: a relative path is useless in an SMS, which has no page context.
    const link = `${env.appOrigin()}/invite/${token}`;

    // The link IS the invitation: a single-use, phone-bound, expiring token. SMS is
    // only an envelope around it, so delivery is opt-in and never load-bearing — the
    // inviter always gets the link back and can hand it over any way they like.
    let sms: { attempted: boolean; sent: boolean; detail?: string } = { attempted: false, sent: false };
    if (wantsSms) {
      if (!smsConfigured()) {
        sms = { attempted: true, sent: false, detail: 'No SMS provider is configured' };
      } else {
        // sendSmsChecked, NOT getSender(). An OtpSender takes a CODE and wraps it in
        // its own copy, which would mangle the link into "your code is https://…".
        const r = await sendSmsChecked(
          String(raw?.phone ?? ''),
          `You have been invited to a box on Content Box: ${link}`,
        );
        sms = r.ok ? { attempted: true, sent: true } : { attempted: true, sent: false, detail: r.detail };
      }
    }

    return NextResponse.json({
      ok: true,
      invitation: { public_id: invitation.public_id, target_role: invitation.target_role, expires_at: invitation.expires_at },
      // Always returned to the INVITER. Safe to hand back: the token is phone-bound,
      // and acceptInvitation still requires the invitee's own verified number.
      link,
      sms,
      // Kept for older clients that read the boolean.
      smsSent: sms.sent,
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

// List this box's invitations so an inviter can see what is outstanding and revoke it.
// Deliberately returns NO phone number: the numbers are encrypted at rest and every
// platform decrypt is audit-logged, which a convenience listing has not earned. An
// invitation is identified by its public id, role and issue time.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { data: box } = await admin().from('box').select('id').eq('public_id', params.id).maybeSingle();
  if (!box) return NextResponse.json({ ok: false, error: 'Box not found' }, { status: 404 });

  const isOperator = await hasRole(account.id, 'platform_operator');
  const allowed = isOperator || (await hasRole(account.id, 'box_admin', (box as { id: string }).id));
  if (!allowed) return NextResponse.json({ ok: false, error: 'Only box admins can view invitations' }, { status: 403 });

  const { data } = await admin()
    .from('invitation')
    .select('public_id, target_role, created_at, expires_at, used_at, revoked_at')
    .eq('box_id', (box as { id: string }).id)
    .order('created_at', { ascending: false })
    .limit(50);

  const now = Date.now();
  const invitations = ((data ?? []) as Array<{
    public_id: string; target_role: string; created_at: string;
    expires_at: string; used_at: string | null; revoked_at: string | null;
  }>).map((i) => ({
    ...i,
    status: i.used_at ? 'accepted'
      : i.revoked_at ? 'revoked'
      : new Date(i.expires_at).getTime() < now ? 'expired'
      : 'pending',
  }));

  return NextResponse.json({ ok: true, invitations });
}
