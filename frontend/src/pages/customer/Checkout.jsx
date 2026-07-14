import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dbAdapter } from "@/services/dbAdapter";
import { paymentAdapter } from "@/services/paymentAdapter";
import { solanaAdapter } from "@/services/solanaAdapter";
import { notify } from "@/services/notificationAdapter";
import { Shield, CreditCard, Loader2, CheckCircle2, ArrowRight } from "lucide-react";

export default function Checkout() {
  const { projectId } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [method, setMethod] = useState("usdc");
  const [paying, setPaying] = useState(false);
  const [funded, setFunded] = useState(false);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    dbAdapter.getProject(projectId).then((proj) => {
      setP(proj);
      if (proj.funded) setFunded(true);
    }).catch(() => {});
    dbAdapter.getSolanaConfig().then((c) => setTestMode(!!c.test_mode)).catch(() => {});

    // Returning from the hosted checkout (Stripe or Ziina): confirm, then fund.
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const returned = sessionId || params.get("paid");
    if (returned) {
      setPaying(true);
      dbAdapter.confirmCardCheckout(projectId, sessionId)
        .then(() => { setFunded(true); notify.success("Payment received", "Your project is now live in the marketplace"); })
        .catch(() => notify.urgent("We couldn't confirm that payment"))
        .finally(() => { setPaying(false); window.history.replaceState({}, "", `/customer/checkout/${projectId}`); });
    } else if (params.get("canceled") || params.get("failed")) {
      notify.urgent("Payment was not completed");
      window.history.replaceState({}, "", `/customer/checkout/${projectId}`);
    }
  }, [projectId]);

  // On funding success, take a brief celebratory beat then whisk them straight
  // into the live bid room - no manual "enter" click required.
  useEffect(() => {
    if (!funded) return;
    const t = setTimeout(() => nav(`/customer/bids/${projectId}`), 1500);
    return () => clearTimeout(t);
  }, [funded, projectId, nav]);

  const fund = async () => {
    setPaying(true);
    try {
      if (testMode) {
        // Presentation mode: skip the real payment entirely.
        await dbAdapter.fundTest(projectId);
        setFunded(true);
        notify.success("Funded (test mode)", "Payment skipped for the demo - your job is live.");
        setPaying(false);
        return;
      }
      if (method === "card") {
        // Real hosted card checkout (Stripe). Redirect to the hosted page.
        try {
          const { url } = await dbAdapter.createCardCheckout(projectId);
          window.location.href = url;
          return;
        } catch (err) {
          if (err.response?.status !== 503) throw err;
          // Card payments not configured on the server - fall back to the demo path.
          await paymentAdapter.fund(projectId, method);
          setFunded(true);
          notify.success("Project funded (demo)", "Card payments aren't configured yet - simulated.");
        }
      } else {
        // Real Solana escrow: send the budget to the platform treasury in the
        // chosen currency, then let the backend verify the transfer on-chain.
        try {
          const isSol = method === "sol";
          const info = await dbAdapter.getSolanaDepositInfo(projectId);
          const opt = isSol ? info.options?.sol : info.options?.usdc;
          if (!opt) throw new Error(isSol ? "SOL pricing is unavailable right now - try USDC." : "USDC unavailable.");
          const unit = isSol ? "SOL" : "USDC";
          notify.success("Confirm in Phantom", `Sending ${opt.amount} ${unit} to escrow…`);
          const signature = isSol
            ? await solanaAdapter.sendSol({ toAddress: info.treasury, amountSol: opt.amount })
            : await solanaAdapter.sendUsdc({ toAddress: info.treasury, amountUsd: opt.amount, mint: info.usdc_mint });
          await dbAdapter.fundSolana(projectId, signature, isSol ? "sol" : "usdc");
          setFunded(true);
          notify.success(`Funded with ${unit}`, "Escrow confirmed on Solana - your job is live.");
        } catch (err) {
          if (err.response?.status === 503) {
            // Solana not configured on the server - fall back to the demo path.
            await paymentAdapter.fund(projectId, method);
            setFunded(true);
            notify.success("Project funded (demo)", "Solana isn't configured yet - simulated.");
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Payment failed";
      notify.urgent(typeof msg === "string" ? msg : "Payment failed");
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
          <span className="label-caps">Project brief - review & edit</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tighter mt-2 mb-4" data-testid="checkout-title">{p.title}</h1>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">{p.description}</p>
          <div className="grid grid-cols-2 gap-2 text-xs mb-6">
            {rows.map(([l, v]) => (
              <div key={l} className="bg-black/40 rounded-lg p-3"><span className="text-zinc-500 block mb-0.5">{l}</span><span className="font-bold">{v || "-"}</span></div>
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
          {testMode && (
            <div className="mt-3 mb-1 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-300 font-bold" data-testid="test-mode-banner">
              🧪 TEST MODE - payment is simulated. No wallet or real money needed.
            </div>
          )}
          <div className="flex justify-between items-center py-4 border-b border-white/10">
            <span className="text-sm text-zinc-400">Public bidding</span>
            <span className="badge-live">OPEN TO ALL CLIPPERS</span>
          </div>
          <div className="flex justify-between items-center py-4 border-b border-white/10">
            <span className="text-sm text-zinc-400">Budget (held in escrow)</span>
            <span className="font-mono font-extrabold text-2xl text-[#CCFF00]" data-testid="checkout-total">${p.budget}</span>
          </div>

          {!funded ? (
            <>
              {!testMode && (
                <div className="py-4 space-y-3">
                  <button data-testid="pay-usdc" onClick={() => setMethod("usdc")} className={`w-full card-dark p-4 flex items-center gap-3 text-left ${method === "usdc" ? "border-[#CCFF00]" : ""}`}>
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#CCFF00] to-emerald-400 flex items-center justify-center text-black font-mono font-extrabold text-xs">$</span>
                    <div><div className="font-bold text-sm">USDC on Solana</div><div className="text-xs text-zinc-500">Stablecoin - exact ${p.budget}, near-zero fees</div></div>
                  </button>
                  <button data-testid="pay-sol" onClick={() => setMethod("sol")} className={`w-full card-dark p-4 flex items-center gap-3 text-left ${method === "sol" ? "border-[#CCFF00]" : ""}`}>
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-white font-mono font-extrabold text-xs">◎</span>
                    <div><div className="font-bold text-sm">SOL (Solana)</div><div className="text-xs text-zinc-500">Pay ${p.budget} worth of SOL at live price</div></div>
                  </button>
                  <button data-testid="pay-card" onClick={() => setMethod("card")} className={`w-full card-dark p-4 flex items-center gap-3 text-left ${method === "card" ? "border-[#CCFF00]" : ""}`}>
                    <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><CreditCard className="w-4 h-4" /></span>
                    <div><div className="font-bold text-sm">Card</div><div className="text-xs text-zinc-500">Visa, Mastercard, Amex</div></div>
                  </button>
                </div>
              )}
              <button data-testid="fund-project-btn" className={`btn-lime h-14 w-full text-base ${testMode ? "mt-4" : ""}`} disabled={paying} onClick={fund}>
                {paying ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : testMode ? `Fund instantly (Test Mode) - $${p.budget}` : `Fund Project - $${p.budget}`}
              </button>
              <p className="text-[10px] text-zinc-600 text-center mt-3">{testMode ? "Test mode is on - no wallet or charge. Released to the clipper when you approve." : "Card & Apple Pay secured by Ziina. Released to the clipper only when you approve."}</p>
            </>
          ) : (
            <div className="py-6 text-center" data-testid="funded-state">
              <CheckCircle2 className="w-12 h-12 text-[#CCFF00] mx-auto mb-3" />
              <p className="font-display font-extrabold text-xl mb-1">Funded & Live</p>
              <p className="text-xs text-zinc-500 mb-6 flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-[#CCFF00]" /> Taking you to the live bid room…</p>
              <button data-testid="goto-bid-room-btn" className="text-sm font-semibold text-[#CCFF00] hover:underline inline-flex items-center gap-1" onClick={() => nav(`/customer/bids/${p.id}`)}>Go now <ArrowRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
