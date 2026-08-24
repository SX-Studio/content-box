import 'server-only';
import { admin } from '@/lib/supabase/admin';

// Admin "Chat with Claude" backend — a small operator assistant that answers
// questions about the platform by calling read-only, PII-free tools (platform
// totals, per-box performance, app-wide search) and summarising the results.
//
// Talks to the Anthropic Messages API over plain fetch (no SDK) to keep the
// serverless bundle small, mirroring lib/verotel and lib/auth/otp-twilio. The
// API key is server-only and never leaves this module.

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_ITERATIONS = 6;

// Default to the current flagship; override with ANTHROPIC_MODEL (e.g. a cheaper
// model) without a code change.
function model(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-opus-5';
}

const SYSTEM = [
  'You are the Content Box admin assistant, helping a platform operator.',
  'Content Box is a temporary multi-creator content-rental marketplace: creators drop content, users rent it for 24h, then it expires.',
  'Tokens are the in-app currency: 100 tokens = €1. Creators earn 80%, the platform keeps 20%.',
  'Answer operational questions using the tools for real numbers — never invent figures. If a tool returns nothing, say so.',
  'The tools expose only aggregate stats and public identifiers; no personal data (phones, real names) is available to you, so never claim to have it.',
  'Be concise and factual. Convert token amounts to euros when it helps.',
].join(' ');

type Tool = { name: string; description: string; input_schema: Record<string, unknown> };

const TOOLS: Tool[] = [
  {
    name: 'platform_stats',
    description: 'Platform-wide totals: accounts, boxes, content, drops in the last hour, rentals, active rentals, tokens in circulation, creator/platform tokens earned, open reports.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'box_stats',
    description: 'Per-box performance. Omit box_public_id for the top boxes by revenue; pass a box public id (e.g. BOX-XXXX) for a single box.',
    input_schema: {
      type: 'object',
      properties: { box_public_id: { type: 'string', description: 'Optional box public id to scope to one box.' } },
      required: [],
    },
  },
  {
    name: 'search',
    description: 'Search boxes, content, and accounts by name/title/public-id. Returns public ids and statuses only (no personal data).',
    input_schema: {
      type: 'object',
      properties: { q: { type: 'string', description: 'Search text, at least 2 characters.' } },
      required: ['q'],
    },
  },
];

async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  const db = admin();
  if (name === 'platform_stats') {
    const { data } = await db.from('platform_stats').select('*').maybeSingle();
    return data ?? {};
  }
  if (name === 'box_stats') {
    const boxPublicId = typeof input.box_public_id === 'string' ? input.box_public_id.trim() : '';
    if (boxPublicId) {
      const { data } = await db.from('box_stats').select('*').eq('public_id', boxPublicId).maybeSingle();
      return data ?? { note: 'No box found for that id.' };
    }
    const { data } = await db.from('box_stats').select('*').order('tokens_in', { ascending: false }).limit(15);
    return data ?? [];
  }
  if (name === 'search') {
    const q = typeof input.q === 'string' ? input.q.trim() : '';
    if (q.length < 2) return { boxes: [], content: [], accounts: [], note: 'Query too short.' };
    const like = `%${q}%`;
    const [boxes, content, accounts] = await Promise.all([
      db.from('box').select('public_id, name, status').or(`name.ilike.${like},public_id.ilike.${like}`).limit(6),
      db.from('content').select('public_id, title, status').or(`title.ilike.${like},public_id.ilike.${like}`).limit(6),
      db.from('account').select('public_id, status').ilike('public_id', like).limit(6),
    ]);
    return { boxes: boxes.data ?? [], content: content.data ?? [], accounts: accounts.data ?? [] };
  }
  return { error: `Unknown tool: ${name}` };
}

type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: string; [k: string]: unknown };
type ApiMessage = { role: 'user' | 'assistant'; content: unknown };

export function assistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Runs the tool-use loop and returns the assistant's final text answer.
export async function runAdminAssistant(message: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return 'The admin assistant is not configured yet. Set ANTHROPIC_API_KEY to enable it.';

  const messages: ApiMessage[] = [{ role: 'user', content: message }];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: model(), max_tokens: 1024, system: SYSTEM, tools: TOOLS, messages }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Anthropic API ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    }

    const data = (await res.json()) as { content: Block[]; stop_reason: string };
    const content = data.content || [];

    if (data.stop_reason === 'tool_use') {
      const toolUses = content.filter((b): b is Extract<Block, { type: 'tool_use' }> => b.type === 'tool_use');
      const results = await Promise.all(
        toolUses.map(async (t) => ({
          type: 'tool_result' as const,
          tool_use_id: t.id,
          content: JSON.stringify(await runTool(t.name, t.input || {})),
        })),
      );
      messages.push({ role: 'assistant', content });
      messages.push({ role: 'user', content: results });
      continue;
    }

    return content
      .filter((b): b is Extract<Block, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim() || 'No answer.';
  }

  return 'I couldn’t complete that in a reasonable number of steps — try narrowing the question.';
}
