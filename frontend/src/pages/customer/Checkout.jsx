import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dbAdapter } from "@/services/dbAdapter";
import { paymentAdapter } from "@/services/paymentAdapter";
import { notify } from "@/services/notificationAdapter";
import { Shield, CreditCard, Loader2, CheckCircle2, ArrowRight } from "lucide-react";

export default function Checkout() {
  const { projectId } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [method, setMethod] = useState("usdc");
  const [paying, setPaying] = useState(false);
  const [funded, setFunded] = useState(false);

  useEffect(() => {
    dbAdapter.getProject(projectId).then((proj) => {
      setP(proj);
      if (proj.funded) setFunded(true);
    }).catch(() => {});
  }, [projectId]);

  const fund = async () => {
    setPaying(true);
    try {
      await paymentAdapter.fund(projectId, method);
      setFunded(true);
      notify.success("Project funded", "Your job is now live in the marketplace");
    } catch {
      notify.urgent("Payment simulation failed");
    }
    setPaying(false);
  };

  if (!p) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><div className="card-dark w-full max-w-2xl h-96 mx-4 animate-pulse" /></div>;

  const rows = [["Category", p.category], ["Platform", p.platform], ["Output", p.output_length], ["Ratio", p.aspect_ratio], ["Captions", p.captions], ["Mood", p.mood], ["Moment", p.moment_mode === "known" ? "Timestamp provided" : "Find the best moment"], ["Source", p.source_link]];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
        {/* Brief */}
        <div className="card-dark p-6 sm:p-8">
          <span className="label-caps">Project brief — review & edit</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tighter mt-2 mb-4" data-testid="checkout-title">{p.title}</h1>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">{p.description}</p>
          <div className="grid grid-cols-2 gap-2 text-xs mb-6">
            {rows.map(([l, v]) => (
              <div key={l} className="bg-black/40 rounded-lg p-3"><span className="text-zinc-500 block mb-0.5">{l}</span><span className="font-bold">{v || "—"}</span></div>
            ))}
          </div>
          <div className="bg-black/40 rounded-xl p-4 flex gap-3 items-start">
            <Shield className="w-5 h-5 text-[#CCFF00] shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-400"><span className="text-white font-bold">Deadline Bond: ${p.bond}.</span> The clipper you accept locks this behind your deadline. If they miss the 24-hour clock, you get a full refund and their bond is credited to you.</p>
          </div>
        </div>

        {/* Payment */}
        <div className="card-dark p-6 sm:p-8 sticky top-24">
          <span className="label-caps">Checkout</span>
          <div className="flex justify-between items-center py-4 border-b border-white/10">
            <span className="text-sm text-zinc-400">Public bidding</span>
            <span className="badge-live"><span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />OPEN TO ALL CLIPPERS</span>
          </div>
          <div className="flex justify-between items-center py-4 border-b border-white/10">
            <span className="text-sm text-zinc-400">Budget (held in escrow)</span>
            <span className="font-mono font-extrabold text-2xl text-[#CCFF00]" data-testid="checkout-total">${p.budget}</span>
          </div>

          {!funded ? (
            <>
              <div className="py-4 space-y-3">
                <button data-testid="pay-usdc" onClick={() => setMethod("usdc")} className={`w-full card-dark p-4 flex items-center gap-3 text-left ${method === "usdc" ? "border-[#CCFF00]" : ""}`}>
                  <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#CCFF00] to-emerald-400 flex items-center justify-center text-black font-mono font-extrabold text-xs">$</span>
                  <div><div className="font-bold text-sm">USDC on Solana</div><div className="text-xs text-zinc-500">Instant, near-zero fees</div></div>
                </button>
                <button data-testid="pay-card" onClick={() => setMethod("card")} className={`w-full card-dark p-4 flex items-center gap-3 text-left ${method === "card" ? "border-[#CCFF00]" : ""}`}>
                  <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><CreditCard className="w-4 h-4" /></span>
                  <div><div className="font-bold text-sm">Card</div><div className="text-xs text-zinc-500">Visa, Mastercard, Amex</div></div>
                </button>
              </div>
              <button data-testid="fund-project-btn" className="btn-lime h-14 w-full text-base" disabled={paying} onClick={fund}>
                {paying ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : `Fund Project — $${p.budget}`}
              </button>
              <p className="text-[10px] text-zinc-600 text-center mt-3">Demo payment — no real funds move. Released to the clipper only when you approve.</p>
            </>
          ) : (
            <div className="py-6 text-center" data-testid="funded-state">
              <CheckCircle2 className="w-12 h-12 text-[#CCFF00] mx-auto mb-3" />
              <p className="font-display font-extrabold text-xl mb-1">Funded & Live</p>
              <p className="text-xs text-zinc-500 mb-6">Your project is in the marketplace. Bids are arriving now.</p>
              <button data-testid="goto-bid-room-btn" className="btn-lime h-12 w-full" onClick={() => nav(`/customer/bids/${p.id}`)}>Enter the Live Bid Room <ArrowRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
