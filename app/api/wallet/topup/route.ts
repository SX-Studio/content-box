import { NextRequest, NextResponse } from 'next/server';
import { currentAccount } from '@/lib/authz';
import { applyWallet, validateTopUpAmount } from '@/lib/wallet';
import { writeAudit } from '@/lib/audit';
import { emit } from '@/lib/events';
import { env } from '@/lib/env';
import { publicId } from '@/lib/ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DEV top-up — grants tokens without a real payment. Only available while the OTP
// sender is the stub (i.e. pre-production). Real token purchase goes through an
// adult-friendly PSP later; this keeps the rent -> earn -> expire loop testable now.
export async function POST(req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (env.otpSender() !== 'stub') {
    return NextResponse.json({ ok: false, error: 'Dev top-up is disabled outside stub mode' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  let amount: number;
  try {
    amount = validateTopUpAmount((body as { amount?: unknown })?.amount);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }

  const ref = publicId('TOP'); // unique dev top-up reference
  const balance = await applyWallet({
    accountId: account.id,
    amount,
    type: 'topup',
    refType: 'dev_topup',
    refId: ref,
    idempotencyKey: ref,
  });
  await writeAudit({ actorId: account.id, action: 'wallet.topup_dev', targetType: 'account', targetId: account.public_id, metadata: { amount } });
  await emit('WALLET_CREDITED', { account_id: account.id, amount, type: 'topup' });
  return NextResponse.json({ ok: true, balance });
}
