-- 0018 — Defense-in-depth: internal authorization inside the payout RPCs
--
-- 0017 locked EXECUTE to service_role, which is the primary control. This adds a
-- second, independent layer *inside* the functions so they refuse illegitimate
-- callers even if a grant ever regresses (as it did in 0014) or the app passes a
-- wrong id. The app's route layer still does its own session/role checks first;
-- these are a backstop, not a replacement.
--
--   request_payout  → the account must exist and be 'active' (a suspended or
--                     restricted creator cannot cash out).
--   decide_payout   → p_decider must be an ACTIVE platform_operator (only an
--                     operator may mark a payout paid or rejected).
--
-- Both are recreated with SECURITY DEFINER + empty search_path (all objects
-- fully qualified). CREATE OR REPLACE preserves privileges, but we re-assert the
-- 0017 lock at the end so this migration is self-contained.

create or replace function public.request_payout(p_creator uuid, p_public_id text)
returns public.payout
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tpe       numeric := coalesce((select value::numeric from public.app_config where key = 'tokens_per_euro'), 100);
  v_thr_eur   numeric := coalesce((select value::numeric from public.app_config where key = 'payout_threshold_eur'), 50);
  v_threshold int := ceil(v_thr_eur * v_tpe);
  v_available int;
  v_payout    public.payout;
begin
  -- Defense-in-depth: only an existing, active account may request a payout.
  if not exists (
    select 1 from public.account
    where id = p_creator and status = 'active'
  ) then
    raise exception 'NOT_AUTHORIZED: creator missing or not active' using errcode = 'P0004';
  end if;

  select coalesce(sum(creator_tokens), 0) into v_available
    from public.earning
    where creator_id = p_creator and state = 'available' and payout_id is null;

  if v_available < v_threshold then
    raise exception 'BELOW_THRESHOLD: % available, need %', v_available, v_threshold using errcode = 'P0001';
  end if;

  insert into public.payout (public_id, creator_id, amount_tokens, eur_cents)
    values (p_public_id, p_creator, v_available, round(v_available / v_tpe * 100)::int)
    returning * into v_payout;

  update public.earning
    set payout_id = v_payout.id
    where creator_id = p_creator and state = 'available' and payout_id is null;

  return v_payout;
end;
$$;

create or replace function public.decide_payout(p_payout uuid, p_decider uuid, p_paid boolean, p_note text)
returns public.payout
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.payout;
begin
  -- Defense-in-depth: only an active platform_operator may decide a payout.
  if not exists (
    select 1 from public.account a
    join public.account_role ar on ar.account_id = a.id
    where a.id = p_decider and a.status = 'active' and ar.role = 'platform_operator'
  ) then
    raise exception 'NOT_AUTHORIZED: decider is not an active platform_operator' using errcode = 'P0004';
  end if;

  select * into v_payout from public.payout where id = p_payout for update;
  if v_payout.id is null then
    raise exception 'PAYOUT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_payout.status <> 'requested' then
    raise exception 'PAYOUT_ALREADY_DECIDED' using errcode = 'P0003';
  end if;

  if p_paid then
    update public.earning set state = 'withdrawn' where payout_id = p_payout;
    update public.payout
      set status = 'paid', note = p_note, decided_at = now(), decided_by = p_decider
      where id = p_payout returning * into v_payout;
  else
    update public.earning set payout_id = null where payout_id = p_payout;
    update public.payout
      set status = 'rejected', note = p_note, decided_at = now(), decided_by = p_decider
      where id = p_payout returning * into v_payout;
  end if;

  return v_payout;
end;
$$;

-- Re-assert the 0017 EXECUTE lock (CREATE OR REPLACE keeps grants, but be explicit).
revoke execute on function public.request_payout(uuid, text) from public, anon, authenticated;
revoke execute on function public.decide_payout(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.request_payout(uuid, text) to service_role;
grant execute on function public.decide_payout(uuid, uuid, boolean, text) to service_role;
