# Twilio SMS setup (OTP delivery)

How to switch OTP delivery from the console **stub** to real **Twilio** SMS, and how
to debug a failed send. Tailored to the EU (Belgium-first) audience.

## How the app uses Twilio

- Sender is selected by `OTP_SENDER` (`stub` | `twilio`). Default when unset: `stub`.
  - `stub` — the 6-digit code is logged to the server console (`[OTP:stub] +32… -> ######`);
    no SMS is sent. Also **opens the dev top-up route** (`/api/wallet/topup`), so do not
    leave a public production site in stub mode.
  - `twilio` — real SMS via Twilio's REST API (`lib/auth/otp-twilio.ts`).
- `lib/env.ts → env.twilio()` needs **all** of `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`,
  `TWILIO_API_KEY_SECRET`, **plus one sender**: `TWILIO_MESSAGING_SERVICE_SID` **or**
  `TWILIO_FROM_NUMBER`. If any are missing, `env.twilio()` returns `null` and the sender
  **silently falls back to the stub** (logs `[OTP:twilio] not configured — falling back to stub`).
  Seeing a `[OTP:stub]` line while `OTP_SENDER=twilio` means a var is missing or misnamed.
- Auth uses a **Standard API Key** (`SK` sid + secret), never the account Auth Token, so a
  leaked key can be revoked without rotating the account.
- On a rejected send Twilio returns a JSON error `{code, message}` and the sender throws;
  the OTP route logs it as `[otp/start] unexpected error: Twilio send failed (NNN): code message`.
  **Read that log line first** — the code names the fix (table below).

## Step 1 — Credentials (API Key, not Auth Token)

1. Twilio Console → **Account → API keys & tokens → Create API key** → type **Standard**.
2. Copy **SID** (`SK…`) → `TWILIO_API_KEY_SID`; **Secret** (shown once) → `TWILIO_API_KEY_SECRET`.
3. Dashboard → **Account SID** (`AC…`) → `TWILIO_ACCOUNT_SID`.

Wrong/missing → error **20003 Authenticate**.

## Step 2 — Pick a sender (choose one)

**Option A — Messaging Service + Alphanumeric Sender ID (recommended for the EU; no number to buy).**
1. **Messaging → Services → Create Messaging Service**.
2. Add a sender → **Alphanumeric Sender ID**, e.g. `ContentBox` (≤ 11 letters). Supported in
   BE/NL/DE/FR. One-way (recipients can't reply) — fine for OTP.
3. Copy the **Messaging Service SID** (`MG…`) → `TWILIO_MESSAGING_SERVICE_SID`.

**Option B — Buy a number.** Phone Numbers → **Buy a number** (SMS-capable) → set as
`TWILIO_FROM_NUMBER` (`+32…`). Simpler, but costs a monthly rental.

## Step 3 — Enable destination countries

**Messaging → Settings → Geo Permissions** → enable **Belgium** (and **NL, DE, FR, LU**).
Applies on trial and paid accounts. Region disabled → error **21408**.

## Step 4 — Trial-account limits

Until you upgrade (add a balance):

- SMS can only go to **verified** numbers — add yours under **Phone Numbers → Verified Caller IDs**.
- Sends to other numbers → **21608** (unverified) or **63038** (daily cap).

To reach real users you must **upgrade**. Until then, `OTP_SENDER=stub` is the way to onboard
arbitrary testers.

## Step 5 — Set env vars in Vercel (Production), then redeploy

```
OTP_SENDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_API_KEY_SID=SK...
TWILIO_API_KEY_SECRET=...
# ONE of:
TWILIO_MESSAGING_SERVICE_SID=MG...      # Option A
# TWILIO_FROM_NUMBER=+32...             # Option B
```

Redeploy — env changes do not apply to existing deployments. Setting `OTP_SENDER=twilio` also
**auto-closes the dev top-up** route.

## Step 6 — Error-code → fix

| Code | Meaning | Fix |
|---|---|---|
| **20003** | Authenticate failed | API key SID/secret wrong, or key not on that account (Step 1) |
| **21608** | Unverified recipient (trial) | Verify the number, or upgrade (Step 4) |
| **21408** | Region not enabled | Enable the country in Geo Permissions (Step 3) |
| **21606 / 21212 / 21611** | `From` invalid / not SMS-capable / not owned | Fix `TWILIO_FROM_NUMBER` or use a Messaging Service (Step 2) |
| **63038** | Daily message cap (trial) | Upgrade |
| `[OTP:stub]` line instead of an SMS | A `TWILIO_*` var is missing | Recheck Step 1–2 names/values |

## Step 7 — Verify

Log in → the code arrives as a real SMS. If it fails, re-read the `[otp/start]` log line, match
the code above, fix, and redeploy. First-try failures are usually **21608** (trial) or **21408**
(geo permission).
