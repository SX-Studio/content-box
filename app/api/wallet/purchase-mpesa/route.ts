import { NextRequest, NextResponse } from 'next/server';
import { currentAccount } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';
import { findPackage } from '@/lib/packages';
import { paystackConfig, initiateMpesaCharge, eurCentsToKesSubunits } from '@/lib/paystack';
import { publicId } from '@/lib/ids';
import { toE164 } from '@/lib/crypto';
import { env } from '@/lib/env';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Start an M-Pesa (Kenya) token purchase via Paystack. Creates a pending token_order,
// fires an STK push to the buyer's phone, and returns a "check your phone" status.
// Wallet is credited later by the Paystack webhook. { configured:false } when the PSP
// env isn't set (client keeps the dev top-up fallback).
export async function POST(req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { packageId?: string; phone?: string };
  const pkg = body.packageId ? findPackage(body.packageId) : undefined;
  if (!pkg) return NextResponse.json({ ok: false, error: 'Unknown package' }, { status: 400 });

  let phone: string;
  try {
    phone = toE164(String(body.phone ?? ''));
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
  if (!phone.startsWith('+254')) {
    return NextResponse.json({ ok: false, error: 'Enter a Kenyan M-Pesa number (+254…)' }, { status: 400 });
  }

  const cfg = paystackConfig();
  if (!cfg.configured) return NextResponse.json({ configured: false });

  const { data: order, error } = await admin()
    .from('token_order')
    .insert({ public_id: publicId('ORD'), account_id: account.id, tokens: pkg.tokens, eur_cents: pkg.eurCents, provider: 'paystack' })
    .select('id, public_id')
    .single();
  if (error || !order) return NextResponse.json({ ok: false, error: 'Order failed' }, { status: 500 });
  const o = order as { id: string; public_id: string };

  const charge = await initiateMpesaCharge({
    secret: cfg.secret,
    email: account.email ?? `${o.public_id.toLowerCase()}@users.content24market.space`,
    amountSubunits: eurCentsToKesSubunits(pkg.eurCents, env.kesPerEur()),
    phoneE164: phone,
    reference: o.public_id,
    metadata: { account: account.public_id, tokens: pkg.tokens },
  });

  if (!charge.ok) {
    await admin().from('token_order').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', o.id);
    return NextResponse.json({ ok: false, error: charge.error ?? 'Could not start payment' }, { status: 400 });
  }

  await admin().from('token_order').update({ provider_ref: o.public_id, updated_at: new Date().toISOString() }).eq('id', o.id);
  await writeAudit({ actorId: account.id, action: 'tokens.order', targetType: 'token_order', targetId: o.public_id, metadata: { tokens: pkg.tokens, provider: 'paystack' } });

  return NextResponse.json({
    configured: true,
    order: o.public_id,
    status: charge.status ?? 'pending',
    message: charge.message ?? 'Check your phone and enter your M-Pesa PIN to approve the payment.',
  });
}
