# Resend setup (email sign-in)

How to turn on **email sign-in** — the second login channel alongside SMS — and how to
read a failed send. Email is independent of `OTP_SENDER`: it works whether SMS runs on
Bird, Twilio or the stub.

> Accuracy note. The error codes and the test-address restriction below are quoted from
> Resend's own docs (`resend.com/docs/api-reference/errors`,
> `resend.com/docs/knowledge-base/403-error-resend-dev-domain`). Free-tier figures are
> from third-party pricing write-ups, not a Resend page we fetched — treat them as
> approximate and confirm in your dashboard. The HTTP-status → fix table is general
> reasoning; always trust the `name message` in the log line first.

## How the app uses Resend

- `lib/email.ts → emailConfigured()` needs **both** `RESEND_API_KEY` and `EMAIL_FROM`.
  Missing either = Resend is off.
- With Resend off, email sign-in behaviour is **deliberately stricter than SMS**:
  - `OTP_SENDER=stub` → the code is logged with the address **masked**
    (`[OTP:email-stub] j*******@example.com -> 123456`) — dev only.
  - any other `OTP_SENDER` → email sign-in is **refused** with a 503,
    *"Email sign-in is not available yet. Please use your phone number."*

  Why: email is independent of `OTP_SENDER`, so a production site running real SMS with
  no Resend would otherwise leak every email code into the Vercel logs, letting anyone
  with log access sign in as anyone.
- `/api/auth/otp/start` checks `emailLoginAvailable()` **up front**, before writing a
  challenge or spending rate-limit budget — so an unconfigured site fails fast and
  doesn't burn the caller's 5-per-15-minutes allowance.
- The call:
  ```
  POST https://api.resend.com/emails
  Authorization: Bearer re_…
  { "from": "<EMAIL_FROM>", "to": "…", "subject": "Your Content Box sign-in code",
    "text": "Your Content Box code is 123456. …" }
  ```
- On rejection Resend returns `{ statusCode, name, message }`. The sender throws
  `Email send failed (NNN): <name> <message>`, which the OTP route logs as
  `[otp/start] unexpected error: …`. **Read that line first** — it names the fix.
  Neither the recipient address nor the code is ever logged or put in the error.

## Step 1 — API key

Create a key at **resend.com/api-keys** (sending permission is enough) and set it as
`RESEND_API_KEY`. It starts with `re_`.

## Step 2 — Pick a sender (`EMAIL_FROM`)

**Option A — Instant smoke test, no DNS.** Set `EMAIL_FROM=onboarding@resend.dev`.
⚠️ Resend's shared test address **only delivers to the email address of the Resend
account owner**. Perfect for proving the wiring end-to-end in two minutes; useless for
real users — every other recipient is rejected with a 403 `validation_error`.

**Option B — Your own domain (required for real sign-ins).** Add
`content24market.space` at **resend.com/domains**, publish the DNS records it gives you
(DKIM + SPF; usually a Return-Path CNAME too), wait for it to go **Verified**, then set:

```
EMAIL_FROM=Content Box <no-reply@content24market.space>
```

Both the `Name <address>` and bare-address forms work — the value is passed to Resend
verbatim as `from`.

Until the domain verifies, sending from it fails with
`403 validation_error: The content24market.space domain is not verified.`

## Step 3 — Set env vars in Vercel (Production), then redeploy

```
RESEND_API_KEY=re_...
EMAIL_FROM=Content Box <no-reply@content24market.space>
```

Redeploy — env changes do not apply to existing deployments. The **Email** tab on
`/login` starts working the moment that deploy is live; no migration, no code change.

## Step 4 — Free-tier limits worth knowing

Roughly **3,000 emails/month, capped at 100/day**, one verified domain. The *daily* cap
is the one teams hit first. A login channel is nowhere near it, but a daily blast plus
logins could be — a 429 `daily_quota_exceeded` in the log line means you found it.

## Step 5 — Reading a failure

The `[otp/start] unexpected error: Email send failed (NNN): <name> <message>` line is
authoritative. Common ones:

| Status / code | Meaning | Fix |
|---|---|---|
| **403 `validation_error`** — "domain is not verified" | `EMAIL_FROM` uses a domain you haven't verified | Step 2, Option B |
| **403 `validation_error`** — "can only send testing emails to your own email address" | You're on `onboarding@resend.dev` and mailed someone else | Step 2, Option B |
| **401 `missing_api_key`** | `RESEND_API_KEY` unset or not reaching the deploy | Step 1 + redeploy |
| **401/403 `restricted_api_key`** | Key lacks send permission | Recreate with sending access |
| **429 `daily_quota_exceeded` / `monthly_quota_exceeded`** | Free-tier cap | Step 4 |
| **429 `rate_limit_exceeded`** | Too many requests per second | Back off |
| 503 *"Email sign-in is not available yet"* | Neither var is set — Resend is off | Step 3 |

## Step 6 — Verify

Open `/login`, switch to the **Email** tab, enter your address, and the code should
arrive. On Option A it only arrives at the Resend account owner's address — that's
expected, not a bug.
