import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';
import { paystackConfig, verifyPaystackSignature } from '@/lib/paystack';
import { applyWallet } from '@/lib/wallet';
import { writeAudit } from '@/lib/audit';
import { emit } from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Paystack webhook. Verifies the HMAC-SHA512 signature over the raw body, then on a
// successful charge credits the buyer's wallet exactly once (idempotency key = the
// Paystack reference = our token_order public id). Tokens come from the order row, not
// the payload, so the amount can't be tampered with.
export async function POST(req: NextRequest) {
  const cfg = paystackConfig();
  if (!cfg.configured) return new NextResponse('Not configured', { status: 503 });

  const raw = await req.text();
  const signature = req.headers.get('x-paystack-signature') ?? '';
  if (!verifyPaystackSignature(raw, signature, cfg.secret)) {
    return new NextResponse('Invalid signature', { status: 400 });
  }

  let evt: { event?: string; data?: { reference?: string; status?: string } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return new NextResponse('Bad body', { status: 400 });
  }
  if (evt.event !== 'charge.success' || String(evt.data?.status) !== 'success') {
    return new NextResponse('OK', { status: 200 }); // ignore non-success events
  }

  const reference = String(evt.data?.reference ?? '');
  if (!reference) return new NextResponse('Missing reference', { status: 400 });

  const { data: order } = await admin()
    .from('token_order')
    .select('id, public_id, account_id, tokens, status')
    .eq('public_id', reference)
    .maybeSingle();
  if (!order) return new NextResponse('Order not found', { status: 404 });
  const o = order as { id: string; public_id: string; account_id: string; tokens: number; status: string };
  if (o.status === 'paid') return new NextResponse('OK', { status: 200 }); // already handled

  await applyWallet({
    accountId: o.account_id,
    amount: o.tokens,
    type: 'purchase',
    refType: 'token_order',
    refId: o.public_id,
    idempotencyKey: `paystack:${reference}`,
  });
  await admin().from('token_order').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', o.id);
  await writeAudit({ actorId: o.account_id, action: 'tokens.credited', targetType: 'token_order', targetId: o.public_id, metadata: { tokens: o.tokens, provider: 'paystack', reference } });
  await emit('TOKENS_PURCHASED', { account_id: o.account_id, tokens: o.tokens, order: o.public_id });

  return new NextResponse('OK', { status: 200 });
}
