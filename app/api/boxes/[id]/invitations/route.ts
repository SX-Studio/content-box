import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';
import { createInvitation } from '@/lib/invitations';
import { sendSms } from '@/lib/sms';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Invite a phone number into this box as creator or user. Box admins (of this box) or
// platform operators only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { data: box } = await admin().from('box').select('id, public_id, status').eq('public_id', params.id).maybeSingle();
  if (!box) return NextResponse.json({ ok: false, error: 'Box not found' }, { status: 404 });

  const allowed = (await hasRole(account.id, 'platform_operator')) || (await hasRole(account.id, 'box_admin', (box as { id: string }).id));
  if (!allowed) return NextResponse.json({ ok: false, error: 'Only box admins can invite' }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
  const raw = body as { phone?: unknown; role?: unknown };
  const role = String(raw?.role ?? '');
  if (role !== 'creator' && role !== 'user') {
    return NextResponse.json({ ok: false, error: 'Role must be creator or user' }, { status: 400 });
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

    // sendSms, NOT getSender(). An OtpSender takes a CODE and wraps it in its own
    // "Your Content Box code is …" copy, so passing an invite link through it produced
    // a garbled message telling the invitee not to share the thing they need to open.
    // sendSms carries arbitrary text and is fire-and-forget (false, never throws), so a
    // delivery problem can't lose an invitation that is already stored.
    const smsSent = await sendSms(
      String(raw?.phone ?? ''),
      `You have been invited to a box on Content Box: ${link}`,
    );

    return NextResponse.json({
      ok: true,
      invitation: { public_id: invitation.public_id, target_role: invitation.target_role, expires_at: invitation.expires_at },
      smsSent,
      // Always returned to the INVITER so they can pass it on themselves when SMS is
      // unavailable — previously this was stub-only, which left no delivery path at all
      // once a real sender was selected. Safe to hand back: the token is phone-bound,
      // and acceptInvitation still requires the invitee's own verified number.
      link,
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
