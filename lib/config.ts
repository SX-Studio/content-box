import 'server-only';
import { admin } from '@/lib/supabase/admin';

// Runtime config read from app_config, with the locked defaults as fallback so the
// app works even before the seed row exists. Values are DB-configurable (no deploy
// needed to change token economics). Phase 3 consumes tokens_per_euro etc.
const DEFAULTS: Record<string, unknown> = {
  tokens_per_euro: 100,
  creator_split: 0.8,
  payout_threshold_eur: 50,
  rental_hours: 24,
  invitation_ttl_hours: 72,
};

export async function getConfig<T = unknown>(key: keyof typeof DEFAULTS | string): Promise<T> {
  const { data } = await admin().from('app_config').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? DEFAULTS[key]) as T;
}

// Operator-editable token economics. Bounds keep values sane before they hit the
// payout/rental math. min/max are inclusive; `integer` forces whole numbers.
export const ECONOMICS = {
  tokens_per_euro: { label: 'Tokens per euro', min: 1, max: 100_000, integer: true },
  creator_split: { label: 'Creator split (0–1)', min: 0, max: 1, integer: false },
  payout_threshold_eur: { label: 'Payout threshold (€)', min: 0, max: 100_000, integer: false },
  rental_hours: { label: 'Rental duration (hours)', min: 1, max: 8760, integer: true },
  invitation_ttl_hours: { label: 'Invitation TTL (hours)', min: 1, max: 8760, integer: true },
} as const;

export type EconomicsKey = keyof typeof ECONOMICS;

export async function getEconomics(): Promise<Record<EconomicsKey, number>> {
  const keys = Object.keys(ECONOMICS) as EconomicsKey[];
  const entries = await Promise.all(keys.map(async (k) => [k, Number(await getConfig<number>(k))] as const));
  return Object.fromEntries(entries) as Record<EconomicsKey, number>;
}

// Validates a single economics value against its bounds; throws on a bad value.
export function validateEconomics(key: string, raw: unknown): { key: EconomicsKey; value: number } {
  if (!(key in ECONOMICS)) throw new Error(`Unknown setting: ${key}`);
  const spec = ECONOMICS[key as EconomicsKey];
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${spec.label} must be a number`);
  if (spec.integer && !Number.isInteger(n)) throw new Error(`${spec.label} must be a whole number`);
  if (n < spec.min || n > spec.max) throw new Error(`${spec.label} must be between ${spec.min} and ${spec.max}`);
  return { key: key as EconomicsKey, value: n };
}

export async function setConfig(key: EconomicsKey, value: number): Promise<void> {
  await admin().from('app_config').upsert({ key, value }, { onConflict: 'key' });
}
