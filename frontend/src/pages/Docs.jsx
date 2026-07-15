import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import Seo from "@/components/Seo";
import { Film, Scissors, Clock, Wallet, ShieldCheck, BookOpen, ArrowRight } from "lucide-react";

const NAV = [
  { id: "getting-started", label: "Getting started" },
  { id: "for-creators", label: "For creators" },
  { id: "for-clippers", label: "For clippers" },
  { id: "the-clock", label: "The 24-hour clock" },
  { id: "payments", label: "Payments & payouts" },
  { id: "trust", label: "Trust & safety" },
];

function Section({ id, icon: Icon, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 pb-14 border-b border-white/[0.06] last:border-0">
      <div className="flex items-center gap-2.5 mb-4">
        {Icon && <Icon className="w-5 h-5 text-[#CCFF00]" />}
        <h2 className="font-display font-bold text-2xl tracking-tight text-white">{title}</h2>
      </div>
      <div className="space-y-4 text-[15px] leading-relaxed text-zinc-400 [&_b]:text-white [&_a]:text-[#CCFF00] [&_a:hover]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export default function Docs() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <Seo title="How it works" path="/docs" description="How 24 Hour Clipping works: post footage, get live bids from vetted clippers, and receive a finished short-form clip within 24 hours backed by a deadline bond. Deadlines, bonds, and payments explained." />
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 flex-1 flex gap-10">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24">
            <div className="flex items-center gap-2 label-caps mb-4"><BookOpen className="w-3.5 h-3.5" /> Documentation</div>
            <nav className="space-y-1">
              {NAV.map((n) => (
                <a key={n.id} href={`#${n.id}`} className="block px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors">
                  {n.label}
                </a>
              ))}
            </nav>
            <div className="mt-6 pt-6 border-t border-white/10">
              <a href="mailto:support@24hourclipping.com" className="text-xs text-zinc-500 hover:text-white transition-colors">Contact support</a>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 max-w-2xl">
          <div className="label-caps mb-2">Docs</div>
          <h1 className="font-display font-extrabold tracking-tight text-3xl sm:text-4xl mb-3">How 24 Hour Clipping works</h1>
          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed mb-12">
            The marketplace for short-form clips, on the clock. Two sides, one 24-hour deadline, zero friction.
          </p>

          <Section id="getting-started" icon={BookOpen} title="Getting started">
            <p>24 Hour Clipping connects <b>creators</b> who need short-form video clips with <b>clippers</b> who edit them. A creator posts a brief and funds it; clippers bid; the winner delivers a finished cut within 24 hours; the creator approves and the clipper gets paid.</p>
            <p>Sign up once - you can be a creator, a clipper, or both. <Link to="/register">Create your account</Link> to begin.</p>
          </Section>

          <Section id="for-creators" icon={Film} title="For creators">
            <ol>
              <li><b>Post a clip.</b> Describe the moment, set a budget, add references and your quality bar, and upload or link your footage. Only the title is required.</li>
              <li><b>Fund it.</b> Pay by card at checkout. Funds are held in escrow and only released when you approve the final cut.</li>
              <li><b>Pick a clipper.</b> Bids land in your live bid room within minutes - compare pitches, ratings, and on-time rates, then accept in one click.</li>
              <li><b>Review & approve.</b> You get a first cut within 24 hours. Request one revision, or approve to release payment.</li>
            </ol>
          </Section>

          <Section id="for-clippers" icon={Scissors} title="For clippers">
            <ol>
              <li><b>Finish your profile.</b> Add your specialties, tools, and a couple of sample clips so creators can find you.</li>
              <li><b>Bid on jobs.</b> Browse open briefs and place a one-tap bid - your price and ETA are prefilled.</li>
              <li><b>Deliver on time.</b> Win the job and the 24-hour clock starts. Upload your cut in the clip room before it hits zero.</li>
              <li><b>Get paid.</b> On approval, your earnings are credited to your balance. Withdraw any time above the minimum to your payout wallet.</li>
            </ol>
          </Section>

          <Section id="the-clock" icon={Clock} title="The 24-hour clock">
            <p>Short-form moves fast, so every live deal runs on a <b>24-hour deadline</b> - creators get cuts while the moment is still hot.</p>
            <ul>
              <li><b>Bonds.</b> Clippers stake a bond on a live deal. Deliver on time and it's returned; miss the deadline and it can go to the creator.</li>
              <li><b>Extensions.</b> If a creator allows it on their brief, a clipper can extend the deadline when they need a little more time.</li>
            </ul>
          </Section>

          <Section id="payments" icon={Wallet} title="Payments & payouts">
            <p><b>Funding (creators).</b> Projects are funded by card through our hosted checkout before work begins. The money is held until you approve the delivery.</p>
            <p><b>Earnings (clippers).</b> When a creator approves your cut, your share (project value minus the 8% platform fee) is credited to your on-platform <b>balance</b>.</p>
            <p><b>Withdrawals.</b> Set a payout wallet in your profile, then withdraw your balance any time above the minimum. Payouts settle in USDC, instantly and globally.</p>
          </Section>

          <Section id="trust" icon={ShieldCheck} title="Trust & safety">
            <p>Funds are only released on approval. Ratings, on-time rates, and bonds keep both sides accountable. Read our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link> for the details.</p>
            <div className="flex items-center gap-3 flex-wrap pt-2">
              <Link to="/register" className="btn-lime h-11 px-6 text-sm">Get started <ArrowRight className="w-4 h-4" /></Link>
              <a href="mailto:support@24hourclipping.com" className="btn-ghost h-11 px-5 text-sm">Contact support</a>
            </div>
          </Section>
        </main>
      </div>
      <Footer />
    </div>
  );
}
