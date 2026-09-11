# Twilio SMS setup (OTP delivery)

How to switch OTP delivery from the console **stub** to real **Twilio** SMS, and how
to debug a failed send. Covers the platform's launch regions: **EU** (Belgium-first:
BE/NL/DE/FR/LU), the **US**, and **Africa** — **South Africa (ZA), Nigeria (NG),
Kenya (KE)**. Each region needs a *different sender type*; a single Messaging Service
can hold all of them and Twilio routes by destination country.

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
- **Use a Messaging Service (`MG…`), not a single `From`, for multi-region.** One
  Messaging Service holds many senders (an EU alphanumeric ID, a US 10DLC/toll-free number,
  registered African sender IDs). Twilio's Sender Pool picks the right one per destination,
  so `TWILIO_MESSAGING_SERVICE_SID` is the only sender var you set in the app.
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

## Step 2 — Senders, per region (add all to ONE Messaging Service)

Create the Messaging Service once: **Messaging → Services → Create Messaging Service**,
copy its **SID** (`MG…`) → `TWILIO_MESSAGING_SERVICE_SID`. Then add the senders below to it.

### EU — Alphanumeric Sender ID (BE/NL/DE/FR/LU)
- Add sender → **Alphanumeric Sender ID**, e.g. `ContentBox` (≤ 11 chars). One-way
  (recipients can't reply) — fine for OTP. Supported across Western EU.
- Some EU countries require the sender ID to be **pre-registered**; the console flags it.

### Africa — Alphanumeric Sender ID **with per-country registration** (ZA/NG/KE)
Alphanumeric is the norm for African OTP, but each country **requires registration before
delivery**, and registration takes lead time (days–weeks) plus signed paperwork. Register
early — unregistered sender IDs are filtered or rejected by local carriers.
- **South Africa (ZA):** register the sender ID via Twilio's Regulatory / Sender ID
  registration.
- **Nigeria (NG):** **mandatory** sender ID registration; requires customer-signed
  documents. See Twilio's NG registration article (Sources).
- **Kenya (KE):** **mandatory** sender ID registration; requires customer-signed
  documents. See Twilio's KE registration article (Sources).
- Where a country does not permit alphanumeric for your traffic, fall back to a local
  long/short code number added to the same Messaging Service.

### US — **NOT alphanumeric**: A2P 10DLC or toll-free
The US does **not** support alphanumeric sender IDs. Pick one and add it to the Messaging
Service:
- **A2P 10DLC (recommended for app OTP):** buy a US 10-digit local number, then register a
  **Brand** + a **Campaign** with use-case **Verification / 2FA (account notification)**.
  Unregistered A2P traffic to the US is **blocked** (error **30034**).
- **Toll-Free:** buy a US toll-free number and complete **Toll-Free Verification**
  (unverified → **30032**). Not part of 10DLC.
- *Alternative:* Twilio **Verify** would let you send US OTP without 10DLC registration,
  but this app uses Programmable Messaging (raw send), so 10DLC or toll-free is required
  here. Switching to Verify would be a code change (`lib/auth/otp-twilio.ts`), out of scope
  for this doc.

## Step 3 — Enable destination countries (Geo Permissions)

**Messaging → Settings → Geo Permissions** → enable **BE, NL, DE, FR, LU, US, ZA, NG, KE**.
Applies on trial and paid accounts. Region disabled → error **21408**.
- Twilio marks some countries **High Risk** for SMS-pumping fraud. **Enable only the
  countries you actually serve** — leave everything else off to cap fraud exposure.

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
TWILIO_MESSAGING_SERVICE_SID=MG...   # holds the EU / US / Africa senders
```

Redeploy — env changes do not apply to existing deployments. Setting `OTP_SENDER=twilio` also
**auto-closes the dev top-up** route.

## Step 6 — SMS-pumping fraud protection (do this before enabling NG/KE)

SMS pumping = fraudsters cycle many numbers on one carrier's range through your OTP field to
farm revenue-share. It's a real cost risk in high-risk geos. Layers:

- **Twilio SMS Pumping Protection** (Programmable Messaging) — enable it on the account.
- **Geo Permissions** — keep the list minimal (Step 3); heed the High-Risk flags.
- **Prefix rate limits** — cap sends to the same number range/prefix.
- **Global Safe List** — allow-list known-good numbers so they're never blocked by the guards.
- **Messaging Insights** — monitor traffic history for anomalies (spikes to one range).
- **App-level guard (recommended follow-up):** the app currently rate-limits **per phone**
  (`lib/ratelimit.ts`, 5 / 15 min) — good, but it doesn't stop an attacker cycling numbers.
  Adding a **per-IP** and **per-country-prefix** cap in `app/api/auth/otp/start` would harden
  NG/KE specifically. Tracked as a separate change, not in this doc.

## Step 7 — Error-code → fix

| Code | Meaning | Fix |
|---|---|---|
| **20003** | Authenticate failed | API key SID/secret wrong, or key not on that account (Step 1) |
| **21408** | Region not enabled | Enable the country in Geo Permissions (Step 3) |
| **21608** | Unverified recipient (trial) | Verify the number, or upgrade (Step 4) |
| **63038** | Daily message cap (trial) | Upgrade |
| **30034** | US A2P 10DLC not registered | Register Brand + Campaign, attach the 10DLC number (Step 2 · US) |
| **30032** | Toll-free not verified | Complete Toll-Free Verification (Step 2 · US) |
| **30007 / 30450** | Carrier filtered (often an unregistered sender ID) | Register the sender ID for that country (Step 2 · Africa) |
| **21606 / 21212 / 21611** | `From` invalid / not SMS-capable / not owned | Fix the sender or use the Messaging Service (Step 2) |
| `[OTP:stub]` line instead of an SMS | A `TWILIO_*` var is missing | Recheck Step 1–2 names/values |

## Step 8 — Verify

Log in → the code arrives as a real SMS. If it fails, re-read the `[otp/start]` log line, match
the code above, fix, and redeploy. First-try failures are usually **21408** (geo), **21608**
(trial), or, for a new region, an **unregistered sender ID** (Africa) / **unregistered 10DLC** (US).

## Sources (verified 2026-09)

- A2P 10DLC (US): https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
- Alphanumeric Sender IDs — international support: https://support.twilio.com/hc/en-us/articles/223133767-International-support-for-Alphanumeric-Sender-ID
- Register a sender ID in Nigeria: https://support.twilio.com/hc/en-us/articles/360039841954-Documents-Required-and-Instructions-to-Register-Your-Alphanumeric-Sender-ID-in-Nigeria
- Register a sender ID in Kenya: https://support.twilio.com/hc/en-us/articles/360039841994-Documents-Required-and-Instructions-to-Register-Your-Alphanumeric-Sender-ID-in-Kenya
- SMS Geo Permissions: https://www.twilio.com/docs/messaging/guides/sms-geo-permissions
- What is SMS Pumping Fraud: https://www.twilio.com/docs/glossary/what-is-sms-pumping-fraud
- SMS Pumping Protection: https://www.twilio.com/docs/messaging/features/sms-pumping-protection-programmable-messaging
