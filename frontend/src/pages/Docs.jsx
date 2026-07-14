import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import { Film, Scissors, Clock, Wallet, ShieldCheck, HelpCircle } from "lucide-react";

const SECTIONS = [
  {
    icon: Film,
    title: "For creators",
    items: [
      ["Post a clip", "Describe the moment you want cut, set a budget, and publish. Title is the only required field; everything else has smart defaults."],
      ["Fund it", "Add funds to your project so clippers know it is real. Money is only released when you approve the final cut."],
      ["Pick a clipper", "Watch bids land in your live bid room, compare pitches and ratings, then accept the one you want in a click."],
      ["Review and approve", "You get a first cut within 24 hours. Request one revision or approve to release payment."],
    ],
  },
  {
    icon: Scissors,
    title: "For clippers",
    items: [
      ["Find a job", "Browse the marketplace, open a brief, and place a bid in one tap. Your amount and ETA are prefilled."],
      ["Win and deliver", "When a creator picks you, the 24 hour clock starts. Upload your cut in the clip room before it hits zero."],
      ["Get paid", "On approval, your payout is released to your wallet. On-time delivery protects your bond and your streak."],
    ],
  },
  {
    icon: Clock,
    title: "The 24 hour clock",
    items: [
      ["Why 24 hours", "Short-form moves fast. Every live deal runs on a 24 hour deadline so creators get cuts while the moment is hot."],
      ["Bonds", "Clippers can stake a bond on a deal. Deliver on time and it is returned; miss the deadline and it can go to the creator."],
    ],
  },
  {
    icon: Wallet,
    title: "Payments",
    items: [
      ["Funding a project", "Creators fund with card or on-chain USDC before work starts. Funds are held until the delivery is approved."],
      ["Payouts", "Clippers set a payout wallet in their profile. Payouts are sent automatically when a deal is approved."],
    ],
  },
];

export default function Docs() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
        <div className="label-caps text-[#CCFF00]/80 mb-2">Docs and help</div>
        <h1 className="font-display font-extrabold tracking-tight text-3xl sm:text-4xl lg:text-5xl">How 24 Hour Clipping works</h1>
        <p className="text-zinc-400 mt-4 text-base sm:text-lg max-w-2xl leading-relaxed">
          Everything you need to go from sign up to a finished clip. Two sides, one clock, zero friction.
        </p>

        <div className="mt-12 grid sm:grid-cols-2 gap-6">
          {SECTIONS.map(({ icon: Icon, title, items }) => (
            <div key={title} className="card-dark p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-10 h-10 rounded-xl bg-[#CCFF00]/[0.08] border border-[#CCFF00]/20 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#CCFF00]" />
                </span>
                <h2 className="font-display font-bold text-lg">{title}</h2>
              </div>
              <div className="space-y-4">
                {items.map(([q, a]) => (
                  <div key={q}>
                    <div className="font-semibold text-[15px] text-white">{q}</div>
                    <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card-dark p-6 mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <span className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-zinc-300" />
          </span>
          <div className="flex-1">
            <h2 className="font-display font-bold text-lg">Trust and safety</h2>
            <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
              Funds are only released on approval. Ratings, on-time rates, and bonds keep both sides accountable. Read our{" "}
              <Link to="/terms" className="text-[#CCFF00] hover:underline">Terms</Link> and{" "}
              <Link to="/privacy" className="text-[#CCFF00] hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>

        <div className="mt-10 flex items-center gap-3 flex-wrap">
          <Link to="/register" className="btn-lime h-12 px-7">Get started</Link>
          <a href="mailto:support@24hourclipping.com" className="btn-ghost h-12 px-6 text-sm">
            <HelpCircle className="w-4 h-4" /> Contact support
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
