import LegalLayout from "@/components/LegalLayout";

export default function Cookies() {
  return (
    <LegalLayout
      title="Cookie Policy"
      updated="July 14, 2026"
      intro="24 Hour Clipping uses a small number of cookies and similar local storage to keep you signed in and to remember your preferences. We do not use advertising cookies."
    >
      <section>
        <h2>What we use</h2>
        <ul>
          <li><b className="text-white">Essential</b>: a session token that keeps you logged in and secures requests. The app cannot work without this.</li>
          <li><b className="text-white">Preferences</b>: local storage that remembers small UI choices, such as dashboards you have already seen.</li>
        </ul>
      </section>
      <section>
        <h2>What we do not use</h2>
        <p>We do not run third-party advertising trackers or sell data to advertisers. We keep the footprint minimal.</p>
      </section>
      <section>
        <h2>Managing cookies</h2>
        <p>You can clear cookies and local storage in your browser settings at any time. Doing so will sign you out and reset saved preferences.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions? Email <a href="mailto:privacy@24hourclipping.com">privacy@24hourclipping.com</a>.</p>
      </section>
    </LegalLayout>
  );
}
