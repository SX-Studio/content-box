# Bird SMS setup (OTP delivery)

How to switch OTP delivery from the console **stub** (or from **Twilio**) to real **Bird** SMS,
and how to read a failed send. Bird is the preferred provider; Twilio is kept as a fallback
(`docs/twilio-setup.md`).

> Accuracy note. The endpoint, auth header, request body, success status and error envelope
> below are taken from Bird's own docs (`bird.com/docs/guides/sms/sending-sms` and the API
> reference conventions page). The HTTP-status → fix table is general HTTP reasoning, not a
> Bird-published code list — always trust the `code message` in the log line first.

## How the app uses Bird

- Sender is selected by `OTP_SENDER` (`stub` | `twilio` | `bird`). Default when unset: `stub`.
  - `stub` — the 6-digit code is logged (`[OTP:stub] +32… -> ######`); no SMS is sent. Also
    **opens the dev top-up route**, so never leave a public production site in stub mode.
  - `bird` — real SMS via `lib/auth/otp-bird.ts`, over the shared transport `lib/bird.ts`.
- `OTP_SENDER=bird` **also routes notification SMS** (payout / identity texts in `lib/sms.ts`)
  through Bird, so a Twilio problem can't silently keep affecting those. Any other value leaves
  the original Twilio notification path exactly as before.
- `lib/env.ts → env.bird()` needs **all** of `BIRD_API_KEY`, `BIRD_REGION`, `BIRD_FROM`. If any is
  missing — or the region isn't `eu1`/`us1` — it returns `null` and the sender **falls back to
  the stub** (logs `[OTP:bird] not configured — falling back to stub`). Seeing an `[OTP:stub]`
  line while `OTP_SENDER=bird` means a var is missing, misnamed, or the region is wrong.
- The call (verified against Bird's docs):
  ```
  POST https://{region}.platform.bird.com/v1/sms/messages
  Authorization: Bearer bk_{region}_…
  { "to": "+32…", "from": "<BIRD_FROM>", "text": "…", "category": "authentication" }
  → 202 Accepted
  ```
  OTP codes are sent with `category: "authentication"`; notification texts with
  `"transactional"`.
- On a rejected send Bird returns a JSON error envelope `{ type, code, message, request_id }`.
  The sender throws `Bird send failed (NNN): <code> <message>` and the OTP route logs it as
  `[otp/start] unexpected error: …`. **Read that log line first** — it names the fix.
  Neither the phone number nor the message text is ever logged.

## Step 1 — API key + region

1. In the Bird dashboard, create an **API key**.
2. Copy it → `BIRD_API_KEY`. The key prefix encodes its region: `bk_eu1_…` (EU) or `bk_us1_…` (US).
3. Set `BIRD_REGION` to **match that prefix** (`eu1` for an EU key). A mismatch is rejected by
   Bird with an auth error, and an unknown value makes the app treat Bird as not configured.

## Step 2 — Pick a sender (`BIRD_FROM`)

**Option A — Alphanumeric sender ID (recommended for the EU; no number to buy).**
Something like `ContentBox` (letters/digits, max 11 characters). One-way — recipients can't
reply — which is fine for OTP. Register/approve it in Bird for your destination countries; several
EU markets require sender-ID pre-registration.

**Option B — A Bird-owned number.** Buy/attach an SMS-capable number in Bird and set it as
`BIRD_FROM` in E.164 form (`+32…`). Simpler approval, but a monthly rental.

## Step 2b — Optional: send the OTP as a template

Bird can send a **stored template** instead of free text. Templates are pre-registered
with operators and generally deliver better for OTP; the template also selects its own
sender and category, so `from`/`category` are omitted from the request.

Verified request shapes (bird.com/docs/api/reference/create-sms-message) — `text` and
`template` are **mutually exclusive**:

```
# free text
{ "to": "+32…", "from": "<BIRD_FROM>", "text": "…", "category": "authentication" }

# template
{ "to": "+32…", "template": { "slug": "bird_otp_verification", "language": "en",
                              "parameters": { "code": "123456" } } }
```

To switch, set `BIRD_TEMPLATE_SLUG` (and optionally `BIRD_TEMPLATE_LANGUAGE`). Bird ships
a built-in **`bird_otp_verification`** template whose variable is `code` — the app passes
the generated code as `parameters.code`, so a custom template must use that variable name
too. Leaving the slug unset keeps the free-text path exactly as before.

A wrong or unapproved slug surfaces as `Bird send failed (404): template_not_found …` in
the `[otp/start]` log line.

## Step 3 — Destination countries

Make sure your sender is enabled for **Belgium** and the other launch markets (**NL, DE, FR, LU**).
A sender that isn't approved for the recipient's country is a 4xx from Bird — the log line will
say so.

## Step 4 — Set env vars in Vercel (Production), then redeploy

```
OTP_SENDER=bird
BIRD_API_KEY=bk_eu1_...
BIRD_REGION=eu1
BIRD_FROM=ContentBox
```

Redeploy — env changes do not apply to existing deployments. Setting `OTP_SENDER=bird` also
**auto-closes the dev top-up** route (same as `twilio`).

**Keep the `TWILIO_*` vars in place** for an instant rollback: switching `OTP_SENDER` back to
`twilio` (and redeploying) restores the previous provider with no code change.

## Step 5 — Reading a failure

The `[otp/start] unexpected error: Bird send failed (NNN): <code> <message>` line is
authoritative. As a first orientation by HTTP status:

| Status | Likely meaning | Where to look |
|---|---|---|
| **401 / 403** | Key invalid, revoked, or **region mismatch** (an `eu1` key sent to the `us1` host) | Step 1 |
| **400 / 422** | Recipient not valid E.164, or `from` sender not approved / not allowed for that country | Steps 2–3 |
| **429** | Rate limited by Bird | Back off; check plan limits |
| **5xx** | Bird-side error | Retry; check Bird's status page |
| `[OTP:stub]` line instead of an SMS | A `BIRD_*` var is missing, or `BIRD_REGION` isn't `eu1`/`us1` | Step 1 / Step 4 |

## Step 6 — Verify

Log in → the code arrives as a real SMS. If it fails, re-read the `[otp/start]` log line, match it
above, fix, and redeploy. Then trigger a payout decision or identity notification to confirm
notification SMS also flows through Bird.
