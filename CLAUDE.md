# Content Box — Project Memory

Read this at the start of every session. Update as state changes.

## What this is
A **temporary multi-creator content rental marketplace** (working name "Content Box").
Creators drop content into a shared **Box**; users browse one central feed, pay with
**tokens**, and **rent** an item for **24 hours** — access then **expires** automatically.
Core loop: **DROP → DISCOVER → RENT → EXPIRE**.

Standalone product; optional SecretXperience integration is a later phase. This is a
**separate repo + separate Supabase project** from SecretXperience.

## Locked decisions (2026-08)
- **Standalone**: own repo (`SX-Studio/Secret-xperience-Chat-Box`) + own Supabase
  project (`jpnnzxnvubrosjjcbkmn`). Fully separate from SX.
- **Stack**: Next.js 14 App Router + TypeScript + Supabase (Postgres/RLS/Storage/cron).
- **Modules, not microservices** (yet): the 11 logical services live as `lib/` modules
  in one app, with an append-only `events` table standing in for Kafka. Extract real
  services only when scale demands it.
- **SMS/OTP**: provider-agnostic adapter (`OtpSender`), selected by `OTP_SENDER`
  (`stub` | `twilio` | `bird`). **Bird is the preferred real provider** (2026-09-11;
  Twilio kept as a fallback because it "has been giving complications"). Both real
  senders fall back to the stub when unconfigured. `OTP_SENDER=bird` also carries
  notification SMS. Docs: `docs/bird-setup.md`, `docs/twilio-setup.md`.
- **Token economics (DB-configurable, in `app_config`)**: €10 = 1000 tokens
  (100 tok = €1), 80/20 creator/platform split, €50 payout threshold, 24h rental.
- **Payments**: ⚠️ **NOT Stripe** — Stripe prohibits adult content. Phase 3 needs an
  adult-friendly PSP + a token/legal analysis (separate compliance track, start early).

## Privacy model (non-negotiable)
Pseudonymous **between participants**, transparent **to the platform**.
- Participants identify each other only by public IDs (`USR-`/`CRT-`/`BOX-`/`CNT-`).
- **No participant ever sees another's phone number or login email.** Only the
  platform can decrypt either, server-side, and every such access is audit-logged.
- Phone stored `phone_enc` (AES-256-GCM) + `phone_hash` (keyed HMAC for lookup).
- Login email stored the same way: `email_enc` + `email_hash` (HMAC domain-separated
  with an `email:` prefix so it can never collide with a phone hash). An account has
  phone, email, or both — never neither (DB CHECK). ⚠️ Distinct from `account.email`
  (0015), the OPTIONAL plaintext *contact* address for notifications — see the
  2026-09-11 log for the follow-up to encrypt that too.

## The 24h rental rule (core)
Every rental has its OWN timer, anchored to the purchase moment:
`purchased_at = now()` (server clock), `expires_at = purchased_at + 24h`, set in the
SAME transaction as the wallet debit. The UI countdown is decorative; the server
re-checks `active AND now() < expires_at` on every view before issuing a signed URL.

## Phase status
- **Phase 1 — Identity & Box foundation** ← in progress
  - ✅ Chunk 1: project scaffold + migrations `0001`–`0005` (account, account_role, box,
    box_membership, invitation, audit_log, events, app_config) + RLS + lib helpers
    (supabase clients, ids, crypto, config) + tests (ids, crypto).
  - ✅ Chunk 2: OTP auth. Migration `0006` (otp_challenge). `lib/auth/*` (adapter +
    stub sender + otp hash/verify), `lib/session*` (signed cookie), `lib/accounts`
    (find-or-create; first account bootstraps as platform_operator), `lib/authz`
    (currentAccount/roles/hasRole), `lib/audit`, `lib/events`, `lib/ratelimit`.
    Routes: `POST /api/auth/otp/start`, `POST /api/auth/otp/verify`,
    `POST /api/auth/logout`, `GET /api/me`. Tests (session, otp) — 15 passing total.
  - ✅ Chunk 3: boxes API. `lib/boxes` (createBox — operator-only, creator becomes
    box_admin; listBoxesForAccount; getBoxForAccount; validateBoxName). Routes
    GET/POST `/api/boxes`, GET `/api/boxes/[id]`.
  - ✅ Chunk 4: invitations API (closes the Phase 1 loop). `lib/invitations`
    (generate/hash token, createInvitation — box_admin/operator, phone-bound,
    72h TTL from app_config; acceptInvitation — session + phone-match required,
    idempotent upsert of membership + role, single-use). Routes
    POST `/api/boxes/[id]/invitations`, POST `/api/invitations/[token]/accept`.
    Invite link returned in `dev` field only while OTP_SENDER=stub. 20 tests total.
  - **Phase 1 core loop is complete**: operator logs in (OTP) → creates box →
    invites creator/user → invitee OTP-verifies → accepts → joins box. All audited
    + events emitted. Migrations `0001`–`0006` live on Supabase.
- **Phase 2 — content upload & processing, blurred feed** ← in progress
  - ✅ Chunk 1: content schema. Migration `0007` (content, content_asset + storage
    buckets: `master` private, `preview` public; RLS deny-by-default). `lib/content`
    (validate title/price, mime/size limits), `lib/media` (sharp: thumbnail + blurred
    preview), `lib/storage` (service-role upload + public preview URL). Routes:
    POST `/api/content` (creator upload → master private + blurred/thumb previews →
    row; auto-approved in Phase 2, moderation gate is Phase 4), GET
    `/api/boxes/[id]/feed` (member-gated; returns blurred previews, never master).
    Tests: validateContentInput/extForMime (24 total). Migration applied to Supabase.
  - ✅ Chunk 2: upload + feed UI. `/box/[id]` page — Drop-content form (image +
    title + price) for creators/box-admins/operators, and the blurred-preview feed
    grid for all members (Rent button disabled until Phase 3). Dashboard box cards
    link to the feed.
  - **Phase 2 complete.** Migrations `0001`–`0007` live.
  - ⏳ Next: Phase 3 (wallet, tokens, rental engine, payouts).
- **Phase 3 — wallet, tokens, rental engine, payouts** ← in progress
  - ✅ Chunk 1: wallet + immutable ledger. Migration `0008` (wallet, ledger_entry,
    earning + `wallet_apply()` SECURITY DEFINER function — atomic, row-locked,
    idempotent, overspend-proof; EXECUTE revoked from anon/authenticated so only
    service_role can call it — advisor-flagged, fixed). `lib/wallet` (getBalance,
    applyWallet via rpc, getLedger, validateTopUpAmount). Routes GET `/api/wallet`,
    POST `/api/wallet/topup` (dev top-up, gated to OTP_SENDER=stub). Wallet panel in
    dashboard. Ledger function verified live (idempotency + overspend). 26 tests.
  - ✅ Chunk 2: rental engine (the heart). Migration `0009` (rental table + partial
    unique one-active-per-user+content; `rent_content()` SECURITY DEFINER — atomic
    debit via wallet_apply + earning split + rental insert; EXECUTE locked to
    service_role). Timer anchored to purchase: `expires_at = now()+rental_hours`.
    `lib/rentals` (rentContent, viewContent → on-access signed URL of the master,
    listMyRentals). Routes POST `/api/content/[id]/rent`, GET
    `/api/content/[id]/view`, GET `/api/rentals/my`. UI: feed Rent button works →
    unlock via signed URL + live countdown; `/rentals` page. Verified live: 250
    debit → 750, 80/20 split, ~24h expiry, idempotent re-rent (no double charge).
    Core loop DROP→DISCOVER→RENT→EXPIRE complete. 26 tests; advisor clean.
  - ⏳ Next: creator earnings dashboard + payout requests (€50 threshold) + the
    expiry sweep job (on-access check already enforces expiry).
- (in progress above) Phase 3 — wallet, tokens, rental engine, payouts
- **Phase 4 — moderation console, AI screening, reports** ← in progress
  - ✅ Chunk 1: moderation backbone. Migration `0010` (moderation_case, report; RLS
    deny-by-default). `lib/moderation` (screenImage stub → low risk; createModerationCase;
    decideContent approve/reject/suspend/delete; listModerationQueue;
    moderationOriginalUrl — signed master URL, audited). `lib/reports` (createReport,
    listReports, resolveReport, validateReportReason). Upload now screens → low risk
    auto-approves, else status 'pending' (moderation case created). viewContent tie-in:
    only 'approved' content is viewable even with an active rental. Routes: moderation
    queue/decision/original/reports/resolve (moderator-gated), POST /api/reports (any
    user). UI: `/moderation` console (content queue + reports, view original, decision
    buttons), dashboard link, feed "⚑ Report" button. 28 tests; advisor clean.
  - ⏳ Next (finish the product): Phase 3 leftovers — creator earnings dashboard +
    payout requests (€50) + pg_cron expiry sweep; then account restrict/suspend in console.

## Session log — 2026-09-11/12 (SMS provider → Bird)
Branch `claude/sms-bird` → PR #10, **merged to `main`** (squash `e6ff737`, 2026-09-12).
Pure config-selected addition; **no migration**, no behaviour change unless
`OTP_SENDER=bird`.

- **Why:** Twilio has been giving complications; the `OtpSender` adapter was built for
  exactly this swap. Bird's *current* API was **verified from bird.com docs, not memory**
  — it is the simple platform API, NOT the older "Channels API": `POST
  https://{eu1|us1}.platform.bird.com/v1/sms/messages`, `Authorization: Bearer
  bk_{region}_…`, flat body `{to, from, text, category}`, `202 Accepted`; error envelope
  `{type, code, message, request_id}`. So only 3 env vars: `BIRD_API_KEY`, `BIRD_REGION`
  (must match the key prefix), `BIRD_FROM` (alphanumeric sender ID or owned number).
- **`lib/bird.ts`** — ONE shared transport (`birdSendSms(to, text, category)`) used by
  both the OTP sender and notification SMS so they can't drift. Never logs phone/text;
  surfaces Bird's `code message` (top-level or nested `error`) in the failure detail.
- **`lib/auth/otp-bird.ts`** — `birdSender`, same contract as Twilio: unconfigured (or
  unknown region) → warn + stub fallback; rejected send → throws `Bird send failed
  (NNN): code message` → visible in `[otp/start] unexpected error:`. OTP uses
  `category:'authentication'`.
- **`lib/sms.ts`** — dispatches on `OTP_SENDER`: `bird` → Bird (`category:
  'transactional'`); **anything else → the original Twilio path, byte-for-byte
  unchanged** (regression-guarded by test). With `OTP_SENDER=bird`, Twilio vars are
  deliberately NOT a silent notification fallback.
- `lib/env.ts → env.bird()`, `lib/auth/sender.ts` `case 'bird'`, `.env.example` Bird
  section, `docs/bird-setup.md` (accuracy-flagged: HTTP-status table is reasoning, the
  log line's Bird code is authoritative), pointer atop `docs/twilio-setup.md`.
- **Template OTP (2026-09-12).** Bird can send a stored template instead of free text;
  verified at bird.com/docs/api/reference/create-sms-message: same endpoint/auth, body
  `{ to, template: { slug, language?, parameters } }`, **mutually exclusive with `text`**,
  and the template picks its own sender + category (so no from/category on that body).
  `lib/bird.ts` refactored onto a private `birdPost()` so both shapes share auth/error
  parsing; adds `birdSendTemplate()`. `otp-bird.ts` branches on the new optional
  `BIRD_TEMPLATE_SLUG` (+ `BIRD_TEMPLATE_LANGUAGE`): set → template with
  `parameters.code`; unset → free text, unchanged (regression-guarded by a test).
  ⚠️ We did NOT add `@messagebird/sdk`: the package is real and `BirdClient` is the
  right export, but its published README documents only `bird.email.send` — `sms.send`
  appears nowhere in it, so that method is unverified; the REST path is verified and
  keeps the serverless bundle small (same rationale as the Twilio sender).
- Tests: `tests/otp-bird.test.ts` (11) + `tests/sms-bird.test.ts` (4). `tsc` clean.
- **To go live (config, not code):** in Vercel set `OTP_SENDER=bird` + the 3 `BIRD_*`
  vars, redeploy. Keep `TWILIO_*` set for instant rollback (`OTP_SENDER=twilio`).
- **Live config (2026-09-12):** `OTP_SENDER=bird`, `BIRD_API_KEY`, `BIRD_REGION` and
  `BIRD_FROM` are set in the Vercel `sx-content-box` project (Production).
  `BIRD_TEMPLATE_SLUG` / `BIRD_TEMPLATE_LANGUAGE` deliberately left UNSET → the
  **free-text** path (the original, test-covered shape). `OTP_SENDER=bird` also closes
  the dev top-up route. Real delivery still depends on the `BIRD_FROM` sender ID being
  approved in Bird for BE/NL/DE/FR/LU — the first live send confirms it; an unapproved
  sender surfaces as a 400/422 in the `[otp/start]` log line, and an `[OTP:stub]` line
  while `OTP_SENDER=bird` means a `BIRD_*` var is missing or the region is wrong.

## Session log — 2026-09-11 (email sign-in, private)
Branch `claude/email-login-private` → PR #9. **Migration `0019_email_login.sql` APPLIED
live** to `jpnnzxnvubrosjjcbkmn` (version `20260911070703`) and verified: all five
`account` columns present with the right nullability, `account_has_login_identifier`
CHECK in place, `otp_challenge.channel` NOT NULL, 0 rows violating. Safe to merge —
the schema is ahead of the code, which is the correct order for an additive change.

- **Email as a second login channel, same privacy model as phone.** Mirrors the phone
  flow end-to-end. `lib/crypto.ts` refactored onto shared `encryptString/decryptString`
  (phone helpers are now thin wrappers, behaviour unchanged) + `encryptEmail/decryptEmail`,
  `emailHash` (domain-separated), `normalizeLoginEmail` (throws; the contact-email
  normaliser in lib/accounts returns null for empty — different on purpose).
  `lib/accounts.ts`: `findAccountByEmailHash`, `findOrCreateAccountByEmail`; the
  first-account operator bootstrap + audit/emit moved into a shared `afterCreate()` so
  both channels behave identically. The admin allowlist stays phone-based.
- **`lib/auth/channel.ts`** — `resolveLoginIdentifier(body)`: the one place deciding
  the channel; exactly one of `{phone,email}` or it throws. Both OTP routes use it.
  `otp_challenge` gained `channel` ('sms'|'email'); the challenge lookup on verify
  filters on channel too, so a phone code can't be redeemed against an email.
- **`lib/auth/otp-email.ts`** — Resend delivery. **Deliberately stricter fallback than
  SMS:** with no Resend configured, codes are stub-logged (address MASKED via
  `maskEmail`) ONLY when `OTP_SENDER=stub`; in any other mode email sign-in is
  refused with a 503 `EmailLoginUnavailable`. Reason: email is independent of
  `OTP_SENDER`, so a prod site running real SMS but no Resend would otherwise leak
  email codes into Vercel logs. The start route checks `emailLoginAvailable()` up
  front, before writing a challenge or spending rate-limit budget.
- **UI** `app/login/page.tsx`: Phone/Email segmented toggle; sends only the active
  identifier. Nullable phone verified safe: every `phone_enc` consumer already
  null-guards; `invitations.ts` phone-match fails *closed* for email-only accounts.
- Tests: `tests/email-login.test.ts` (13) — 76 total passing; `tsc --noEmit` clean.
- **Follow-ups (not in this PR, by design — reviewable chunks):** (1) email-bound box
  invitations (`acceptInvitation` still requires a phone match, so an email-only
  account can log in but can't yet join a box via invite); (2) link a second
  identifier to an existing account (avoid duplicate accounts); (3) encrypt the
  legacy plaintext `account.email` contact column to match this model.

## Session log — 2026-08-30 (login fix · payout security · Twilio docs)
Three PRs merged to `main`; two DB migrations applied live to `jpnnzxnvubrosjjcbkmn`.

- **Login "Unexpected end of JSON input" fixed (PR #2).** The login page did
  `await r.json()` unconditionally, so a bodyless 500 from an OTP route surfaced as that
  cryptic message. Root cause: the `otp_challenge` row inserts fine, then
  `getSender().send()` **throws** (Twilio rejects the send) → uncaught → empty 500.
  Fix: a `readJson()` helper in `app/login/page.tsx` (tolerates empty/non-JSON bodies),
  and a top-level try/catch in `app/api/auth/otp/{start,verify}/route.ts` that logs the
  real cause (`[otp/start] unexpected error: …`) and returns parseable JSON.
  ⚠️ Resilience only — real login still needs OTP delivery configured (see Outstanding).

- **Payout RPC security hardening (PR #3) — applied live.** The Supabase security advisor
  flagged `request_payout` / `decide_payout` as callable by `anon`/`authenticated`.
  Confirmed real: migration `0014` did `revoke … from anon, authenticated` but NOT from
  `PUBLIC`, so both roles still inherited EXECUTE and could hit `/rest/v1/rpc/decide_payout`
  with the public key (no internal authz — a money endpoint). Fixed in two layers:
  - `0017_lock_payout_execute.sql` — `revoke execute … from public, anon, authenticated`.
  - `0018_payout_internal_authz.sql` — internal guards: `request_payout` requires an ACTIVE
    account; `decide_payout` requires an ACTIVE `platform_operator` (both raise `P0004`
    before doing any work). Verified live; both advisor WARNs cleared.
  Lesson: locking a SECURITY DEFINER money function needs `revoke execute … from PUBLIC`,
  not just anon/authenticated (that's how `wallet_apply`/`rent_content` were done right).

- **Twilio setup documented (PR #4).** `docs/twilio-setup.md` — stub→Twilio switch,
  Standard API Key, Messaging Service + alphanumeric sender ID vs a bought number, EU
  geo-permissions, trial limits, env vars, and a Twilio error-code → fix table matching
  the new `[otp/start]` log line. Pointer added to Useful files.

### ⚠️ Outstanding (config, not code): OTP delivery on Vercel
Login won't complete for real users until OTP delivery is set in the `sx-content-box`
Vercel project (then redeploy — env changes don't touch existing deployments):
- **Unblock testing now:** `OTP_SENDER=stub` (or unset) — the code prints in the Vercel
  log as `[OTP:stub] … -> ######`. ⚠️ stub mode also OPENS `/api/wallet/topup` (free
  tokens for any signed-in user) — never leave a public production site in stub mode.
- **Real SMS:** `OTP_SENDER=twilio` + the `TWILIO_*` vars — see `docs/twilio-setup.md`.
- Live Supabase state (verified this session): migrations `0001`–`0018` all applied,
  `otp_challenge` writing normally — the DB is healthy; the blocker is Twilio config.

## Architecture quirks / patterns
- **All Phase 1 DB access via server routes using the service-role client** (`lib/supabase/admin.ts`).
  RLS is enabled + deny-by-default for anon/authenticated as the second lock.
- `import 'server-only'` guards server modules; vitest aliases it to a stub so pure
  helpers stay testable.
- Next 14: `cookies()` is **async** (unlike SX's Next 13.5.1).
- Public IDs via `lib/ids.ts` (Crockford base32, no I/L/O/U).

## Constraints / don'ts
- Never store or log a plaintext phone number.
- Never expose the service-role key or `lib/crypto` / `lib/supabase/admin` to the client.
- Never wire Stripe for token purchase in this product.
- Work in reviewable chunks: analyse → build → test → security check → report → next.
- Don't break existing functionality without explicit permission.

## Useful files
- `supabase/migrations/` — schema + RLS (`0001`–`0019`, all applied live; `0019` = email login)
- `lib/supabase/{admin,server,client}.ts` — service-role / SSR / browser clients
- `lib/crypto.ts` — phone + login-email encrypt/decrypt, domain-separated HMACs, E.164 / email normalise
- `lib/auth/channel.ts` — `resolveLoginIdentifier`: phone-xor-email channel resolution for the OTP routes
- `lib/auth/otp-email.ts` — Resend OTP delivery with the strict (masked-stub / 503) fallback policy
- `lib/ids.ts` — public ID generation
- `lib/config.ts` — reads `app_config` (token defaults)
- `tests/` — vitest (unit +, later, integration/security)
- `lib/bird.ts` — shared Bird SMS transport (OTP + notifications); `lib/auth/otp-bird.ts` — Bird OTP sender
- `docs/bird-setup.md` — switch OTP delivery to Bird (preferred) + how to read a failed send
- `docs/twilio-setup.md` — Twilio (fallback provider) setup + error-code fixes

## How to run
```bash
npm install
cp .env.example .env.local   # Supabase keys + generated crypto keys
npm run test
npm run dev
```
