import 'server-only';
import type { OtpSender } from './otp-adapter';
import { stubSender } from './otp-stub';
import { birdSendSms, birdSendTemplate } from '@/lib/bird';
import { env } from '@/lib/env';

// Real OTP delivery over Bird (platform.bird.com). Same contract as the Twilio
// sender so `OTP_SENDER` can flip between them with no other change:
//
// Safe fallback: if Bird is not (fully) configured, delegate to the stub sender
// (logs the code) so the auth flow keeps working in dev / before the env vars are
// set. A configured-but-rejected send throws so the failure is visible in the
// `[otp/start] unexpected error:` log line.
//
// Two send shapes, chosen by BIRD_TEMPLATE_SLUG:
//   set   → a stored Bird template (e.g. `bird_otp_verification`), which is
//           pre-registered with the operator and generally lands better.
//   unset → free text, the original behaviour.
// The template's variable for the code is assumed to be `code`, matching Bird's
// built-in OTP template; a custom template must use that variable name too.
export const birdSender: OtpSender = {
  async send(phoneE164, code) {
    const cfg = env.bird();
    if (!cfg) {
      // eslint-disable-next-line no-console
      console.warn('[OTP:bird] not configured — falling back to stub');
      return stubSender.send(phoneE164, code);
    }

    const r = cfg.templateSlug
      ? await birdSendTemplate(phoneE164, cfg.templateSlug, { code }, cfg.templateLanguage || undefined)
      : await birdSendSms(
          phoneE164,
          `Your Content Box code is ${code}. It expires in a few minutes. Do not share it.`,
          'authentication',
        );
    if (!r.ok) throw new Error(`Bird send failed (${r.status})${r.detail ? `: ${r.detail}` : ''}`);
  },
};
