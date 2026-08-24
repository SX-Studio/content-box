import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { getEconomics, setConfig, validateEconomics } from '@/lib/config';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireOperator() {
  const account = await currentAccount();
  if (!account) return { error: NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 }) };
  if (!(await hasRole(account.id, 'platform_operator'))) {
    return { error: NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 }) };
  }
  return { account };
}

// Read the current token economics.
export async function GET() {
  const gate = await requireOperator();
  if (gate.error) return gate.error;
  return NextResponse.json({ ok: true, economics: await getEconomics() });
}

// Update one or more economics values. Body: { updates: { key: value, ... } }.
export async function POST(req: NextRequest) {
  const gate = await requireOperator();
  if (gate.error) return gate.error;

  const { updates } = (await req.json().catch(() => ({}))) as { updates?: Record<string, unknown> };
  if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 });
  }

  try {
    const validated = Object.entries(updates).map(([k, v]) => validateEconomics(k, v));
    for (const { key, value } of validated) await setConfig(key, value);
    await writeAudit({
      actorId: gate.account!.id,
      action: 'admin.economics_updated',
      targetType: 'app_config',
      targetId: validated.map((v) => v.key).join(','),
      metadata: Object.fromEntries(validated.map((v) => [v.key, v.value])),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, economics: await getEconomics() });
}
