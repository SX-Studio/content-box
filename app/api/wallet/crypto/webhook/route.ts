import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';
import { nowpaymentsConfig, verifyIpn } from '@/lib/nowpayments';
import { applyWallet } from '@/lib/wallet';
import { writeAudit } from '@/lib/audit';
import { emit } from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// NOWPayments IPN callback. Verifies the x-nowpayments-sig signature, then — only
// on a fully settled payment — credits the buyer's wallet exactly once
// (idempotency key = the NOWPayments payment id), mirroring the Verotel webhook.
export async function POST(req: NextRequest) {
  const cfg = nowpaymentsConfig();
  if (!cfg.configured) return new NextResponse('Not configured', { status: 503 });

  const raw = await req.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return new NextResponse('Bad body', { status: 400 });
  }

  const sig = req.headers.get('x-nowpayments-sig') ?? '';
  if (!verifyIpn(body, sig, cfg.ipnSecret)) return new NextResponse('Invalid signature', { status: 400 });

  const status = String(body.payment_status ?? '');
  const orderId = String(body.order_id ?? '');
  const paymentId = String(body.payment_id ?? '');
  if (!orderId || !paymentId) return new NextResponse('Missing fields', { status: 400 });
  // Credit only when the payment is fully settled; other states are acknowledged.
  if (status !== 'finished') return new NextResponse('OK', { status: 200 });

  const { data: order } = await admin()
    .from('token_order')
    .select('id, public_id, account_id, tokens, status')
    .eq('id', orderId)
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
    idempotencyKey: `nowpayments:${paymentId}`,
  });
  await admin().from('token_order').update({ status: 'paid', provider_ref: paymentId, updated_at: new Date().toISOString() }).eq('id', o.id);
  await writeAudit({ actorId: o.account_id, action: 'tokens.credited', targetType: 'token_order', targetId: o.public_id, metadata: { tokens: o.tokens, paymentId, provider: 'nowpayments' } });
  await emit('TOKENS_PURCHASED', { account_id: o.account_id, tokens: o.tokens, order: o.public_id });

  return new NextResponse('OK', { status: 200 });
}
