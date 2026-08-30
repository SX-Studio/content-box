-- 0017 — Lock payout RPC EXECUTE to service_role only
--
-- 0014 created request_payout / decide_payout as SECURITY DEFINER and tried to
-- lock them with `revoke all ... from anon, authenticated`. That is insufficient:
-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default, and a revoke from
-- anon/authenticated does NOT remove the PUBLIC grant — so both roles still inherit
-- EXECUTE via PUBLIC and can call the functions over /rest/v1/rpc with the anon key.
-- These functions carry no internal authorization check (they trust p_decider /
-- p_paid / p_creator), so an open EXECUTE grant lets anyone mark a payout paid or
-- open payout requests. wallet_apply / rent_content are already locked this way.
--
-- Fix: revoke EXECUTE from PUBLIC (and anon/authenticated explicitly), keep it for
-- service_role. The app calls both only via the service-role admin client
-- (/api/payouts/request, /api/admin/payouts/decide), so nothing legitimate breaks.

revoke execute on function public.request_payout(uuid, text) from public, anon, authenticated;
revoke execute on function public.decide_payout(uuid, uuid, boolean, text) from public, anon, authenticated;

grant execute on function public.request_payout(uuid, text) to service_role;
grant execute on function public.decide_payout(uuid, uuid, boolean, text) to service_role;
