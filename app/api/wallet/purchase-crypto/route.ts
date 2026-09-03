import { NextRequest, NextResponse } from 'next/server';
import { currentAccount } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';
import { findPackage } from '@/lib/packages';
import { nowpaymentsConfig, createInvoice } from '@/lib/nowpayments';
import { publicId } from '@/lib/ids';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Start a crypto token purchase via NOWPayments. Creates a pending token_order
// (provider 'nowpayments') and returns a hosted invoice URL. Graceful
// { configured:false } when the crypto env isn't set (client keeps dev top-up).
export async function POST(req: NextRequest) {
  try {
    const account = await currentAccount();
    if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const { packageId } = (await req.json().catch(() => ({}))) as { packageId?: string };
    const pkg = packageId ? findPackage(packageId) : undefined;
    if (!pkg) return NextResponse.json({ ok: false, error: 'Unknown package' }, { status: 400 });

    const cfg = nowpaymentsConfig();
    if (!cfg.configured) return NextResponse.json({ configured: false });

    const { data: order, error } = await admin()
      .from('token_order')
      .insert({ public_id: publicId('ORD'), account_id: account.id, tokens: pkg.tokens, eur_cents: pkg.eurCents, provider: 'nowpayments' })
      .select('id, public_id')
      .single();
    if (error || !order) return NextResponse.json({ ok: false, error: 'Order failed' }, { status: 500 });

    const inv = await createInvoice({
      apiKey: cfg.apiKey,
      priceEur: pkg.eurCents / 100,
      orderId: (order as { id: string }).id,
      description: `${pkg.tokens} tokens - Content Box`, // ASCII only
    });
    if (!inv) return NextResponse.json({ ok: false, error: 'Could not start crypto checkout' }, { status: 502 });

    await writeAudit({ actorId: account.id, action: 'tokens.order', targetType: 'token_order', targetId: (order as { public_id: string }).public_id, metadata: { tokens: pkg.tokens, provider: 'nowpayments' } });
    return NextResponse.json({ configured: true, url: inv.url });
  } catch (e) {
    console.error('[wallet/purchase-crypto] unexpected error:', e);
    return NextResponse.json({ ok: false, error: 'Server error starting crypto checkout' }, { status: 500 });
  }
}
