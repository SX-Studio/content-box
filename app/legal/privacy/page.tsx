export const metadata = { title: 'Privacy Policy · Content Box' };

export default function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="dim">Last updated: 24 August 2026 · Draft for legal review.</p>

      <p>This policy explains how [Operator Legal Name] (&ldquo;we&rdquo;), as data controller, processes personal data for Content Box. We aim to comply with the EU/EEA GDPR.</p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Account:</strong> phone number (stored encrypted; a keyed hash is used for lookup), optional contact email, account identifiers, roles.</li>
        <li><strong>Identity verification (creators):</strong> full name, date of birth, country, ID document image, and optional selfie. Stored in a private, access-controlled store.</li>
        <li><strong>Financial:</strong> token purchases, wallet ledger, rentals, earnings and payout records. Card data is handled by our payment providers, not by us.</li>
        <li><strong>Content &amp; usage:</strong> content you upload, rentals, moderation records, and technical logs (e.g. IP, timestamps) for security and abuse prevention.</li>
      </ul>

      <h2>2. Why we process it (legal bases)</h2>
      <ul>
        <li><strong>Contract:</strong> to operate accounts, boxes, rentals, and payouts.</li>
        <li><strong>Legal obligation:</strong> age/identity verification and record-keeping for adult content, tax, and responding to lawful requests.</li>
        <li><strong>Legitimate interests:</strong> security, fraud and abuse prevention, and improving the service.</li>
        <li><strong>Consent:</strong> optional notifications and any processing where we ask for it; you may withdraw consent at any time.</li>
      </ul>

      <h2>3. Sharing</h2>
      <p>We share data only with processors acting on our instructions — hosting/database (Supabase), payment providers, and SMS/email providers (Twilio, Resend) — under appropriate agreements. Between participants, accounts are pseudonymous: creators and members do not see each other&rsquo;s real identity or phone number. We disclose data to authorities where legally required.</p>

      <h2>4. Retention</h2>
      <p>We keep account and transaction data for as long as your account is active and as required by law afterwards (e.g. age-verification and financial records for statutory periods). Identity documents are retained for the period required by applicable record-keeping law and then deleted.</p>

      <h2>5. Security</h2>
      <p>Phone numbers are encrypted at rest; identity documents live in a private store reachable only by authorized reviewers via short-lived links. Access is role-restricted and audit-logged. No system is perfectly secure, but we take appropriate technical and organizational measures.</p>

      <h2>6. Your rights</h2>
      <p>Subject to law, you may request access, correction, deletion, restriction, portability, or object to processing, and lodge a complaint with your supervisory authority. To exercise these rights contact privacy@content24market.space. Note that some data (e.g. age-verification and financial records) must be retained despite a deletion request.</p>

      <h2>7. International transfers</h2>
      <p>Where data is processed outside the EEA, we rely on appropriate safeguards such as Standard Contractual Clauses.</p>

      <h2>8. Contact</h2>
      <p>Controller: [Operator Legal Name], [registered address]. Privacy contact: privacy@content24market.space.</p>
    </>
  );
}
