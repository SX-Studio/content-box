import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { runAdminAssistant } from '@/lib/admin-assistant';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin assistant ("Chat with Claude"). Operator-only. Answers via read-only,
// PII-free tools (platform/box stats, app-wide search). Graceful when
// ANTHROPIC_API_KEY is unset so the bar still works end-to-end.
export async function POST(req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!(await hasRole(account.id, 'platform_operator'))) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const { message } = (await req.json().catch(() => ({}))) as { message?: string };
  const trimmed = (message ?? '').trim();
  if (!trimmed) return NextResponse.json({ ok: false, error: 'Empty message' }, { status: 400 });

  try {
    const reply = await runAdminAssistant(trimmed);
    await writeAudit({ actorId: account.id, action: 'admin.assistant_query', targetType: 'account', targetId: account.public_id });
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ reply: `Assistant error: ${(e as Error).message}` }, { status: 200 });
  }
}
