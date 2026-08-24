export const metadata = { title: 'Age verification & records · Content Box' };

export default function Records() {
  return (
    <>
      <h1>Age verification &amp; record-keeping</h1>
      <p className="dim">Last updated: 24 August 2026 · Draft for legal review.</p>

      <p>Content Box is committed to ensuring that every person appearing in content on the platform is an adult and has consented. This statement describes our age-verification and record-keeping practices, informed by 18 U.S.C. § 2257 record-keeping principles and EU/national requirements. It is not legal advice.</p>

      <h2>1. Creator verification</h2>
      <p>Before publishing, every creator must complete identity verification: they submit their full legal name, date of birth, a government-issued photo ID, and (optionally) a selfie, and affirmatively consent that they are 18 or older, that the ID is genuinely theirs, and that they consent to processing. A human reviewer confirms the person is an adult before the account is allowed to publish.</p>

      <h2>2. Consent of all persons depicted</h2>
      <p>Creators must confirm, for every upload, that they hold rights to the content and that each person depicted is an adult who has given written, informed consent to its creation and distribution. Content depicting anyone other than the verified creator may require additional proof of age and consent on request.</p>

      <h2>3. Records we keep</h2>
      <ul>
        <li>Verification records: name, date of birth, document type, document/selfie images, consent flag and timestamp, reviewer decision and timestamp.</li>
        <li>Content records: creator identity linkage, upload timestamps, and moderation decisions.</li>
      </ul>
      <p>These records are stored securely in access-controlled systems, retained for the period required by applicable law, and produced to authorities on lawful request.</p>

      <h2>4. Custodian of records</h2>
      <p>Records required under applicable law are maintained by the Custodian of Records: [Custodian name], [address]. Requests concerning records should be directed to legal@content24market.space.</p>

      <h2>5. Zero tolerance</h2>
      <p>We have a zero-tolerance policy toward any content involving minors or non-consenting persons. Such content is removed immediately and reported to the competent authorities (including NCMEC and/or national hotlines) as required by law, and the responsible account is terminated.</p>

      <p className="dim" style={{ fontSize: 12 }}>The exact records, retention periods, and custodian designation must be confirmed with legal counsel for each jurisdiction in which the service operates.</p>
    </>
  );
}
