import LegalLayout from "@/components/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      updated="July 14, 2026"
      intro="This policy explains what information 24 Hour Clipping collects, how we use it, and the choices you have. We keep it plain and short on purpose."
    >
      <section>
        <h2>Information we collect</h2>
        <ul>
          <li><b className="text-white">Account details</b> you give us: name, email, password (stored hashed), and role (creator or clipper).</li>
          <li><b className="text-white">Profile content</b>: avatars, specialties, tools, portfolio links, and brand briefs you add.</li>
          <li><b className="text-white">Project and payment data</b>: briefs, bids, deliveries, messages, and payout wallet addresses.</li>
          <li><b className="text-white">Usage data</b>: basic logs and device information needed to run and secure the service.</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>To run the marketplace: match creators with clippers, process funding and payouts, deliver notifications, prevent fraud, and improve the product. We do not sell your personal data.</p>
      </section>
      <section>
        <h2>Sharing</h2>
        <p>We share data only with service providers that help us operate, such as our email provider (Brevo) for transactional messages and our payment infrastructure. Public profile fields (your clipper name, specialty, ratings, and portfolio) are visible to other users by design.</p>
      </section>
      <section>
        <h2>Email</h2>
        <p>We send transactional email such as a welcome message, bid updates, and delivery notices from a no-reply address. These are required to use the service and are not marketing.</p>
      </section>
      <section>
        <h2>Data retention and security</h2>
        <p>We keep your data for as long as your account is active. Passwords are hashed and never stored in plain text. You can request deletion of your account at any time.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>You can view and edit your profile, update your brand brief, and request account deletion by contacting us at <a href="mailto:privacy@24hourclipping.com">privacy@24hourclipping.com</a>.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions about privacy? Email <a href="mailto:privacy@24hourclipping.com">privacy@24hourclipping.com</a>.</p>
      </section>
    </LegalLayout>
  );
}
