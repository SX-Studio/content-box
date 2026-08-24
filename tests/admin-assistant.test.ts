import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('admin assistant', () => {
  beforeEach(() => { vi.resetModules(); delete process.env.ANTHROPIC_API_KEY; });
  afterEach(() => { vi.restoreAllMocks(); delete process.env.ANTHROPIC_API_KEY; });

  it('reports not configured and makes no API call without a key', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { runAdminAssistant, assistantConfigured } = await import('@/lib/admin-assistant');
    expect(assistantConfigured()).toBe(false);
    const reply = await runAdminAssistant('how many boxes?');
    expect(reply).toMatch(/not configured/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('runs a tool call then returns the final text answer', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    // Mock the DB used by the tool executor.
    vi.doMock('@/lib/supabase/admin', () => ({
      admin: () => ({
        from: () => ({
          select: () => ({ maybeSingle: async () => ({ data: { boxes: 3, accounts: 10 } }) }),
        }),
      }),
    }));

    const toolTurn = {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'tu_1', name: 'platform_stats', input: {} }],
    };
    const finalTurn = {
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'There are 3 boxes and 10 accounts.' }],
    };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(toolTurn), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(finalTurn), { status: 200 }));

    const { runAdminAssistant } = await import('@/lib/admin-assistant');
    const reply = await runAdminAssistant('how many boxes?');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(reply).toBe('There are 3 boxes and 10 accounts.');
    // Second call must carry the tool_result back to the model.
    const secondBody = JSON.parse((fetchSpy.mock.calls[1][1] as RequestInit).body as string);
    const lastMsg = secondBody.messages[secondBody.messages.length - 1];
    expect(lastMsg.role).toBe('user');
    expect(lastMsg.content[0].type).toBe('tool_result');
    expect(lastMsg.content[0].tool_use_id).toBe('tu_1');
  });

  it('surfaces an Anthropic API error', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad request', { status: 400 }));
    const { runAdminAssistant } = await import('@/lib/admin-assistant');
    await expect(runAdminAssistant('hi')).rejects.toThrow(/Anthropic API 400/);
  });
});
