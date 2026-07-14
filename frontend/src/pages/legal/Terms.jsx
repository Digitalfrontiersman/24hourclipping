import LegalLayout from "@/components/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout
      title="Terms of Service"
      updated="July 14, 2026"
      intro="These terms govern your use of 24 Hour Clipping. By creating an account you agree to them. Please read them carefully."
    >
      <section>
        <h2>The service</h2>
        <p>24 Hour Clipping is a marketplace that connects creators who need short-form video clips with clippers who edit them. Creators post briefs and fund projects; clippers bid, deliver, and get paid on approval.</p>
      </section>
      <section>
        <h2>Accounts</h2>
        <p>You must provide accurate information and keep your login secure. You are responsible for activity under your account. You must be old enough to form a binding contract in your jurisdiction.</p>
      </section>
      <section>
        <h2>Payments, funding, and bonds</h2>
        <ul>
          <li>Creators fund a project before a clipper begins. Funds are released to the clipper when the delivery is approved.</li>
          <li>Clippers may stake a bond on a live deal. Missing a deadline can forfeit the bond to the creator, as described in the deal.</li>
          <li>Fees, payout methods, and currencies are shown at checkout. You are responsible for any taxes that apply to you.</li>
        </ul>
      </section>
      <section>
        <h2>Deadlines and delivery</h2>
        <p>The 24 hour clock is central to the service. Clippers agree to deliver within the agreed window. Creators agree to review deliveries in good faith and within a reasonable time.</p>
      </section>
      <section>
        <h2>Content and ownership</h2>
        <p>Creators are responsible for having the rights to any footage they upload. On approval and payment, ownership of the delivered cut transfers to the creator unless the deal states otherwise. You grant us a limited license to host and display content as needed to run the service.</p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>No illegal, infringing, or harmful content. No attempts to bypass payments, scrape the platform, or abuse other users. We may suspend accounts that break these rules.</p>
      </section>
      <section>
        <h2>Disclaimers and liability</h2>
        <p>The service is provided as is. To the extent permitted by law, we are not liable for indirect or consequential damages. Our total liability is limited to the fees you paid us in the prior three months.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>We may update these terms. We will post the new date above and, for material changes, notify you. Continued use means you accept the updated terms.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions about these terms? Email <a href="mailto:support@24hourclipping.com">support@24hourclipping.com</a>.</p>
      </section>
    </LegalLayout>
  );
}
