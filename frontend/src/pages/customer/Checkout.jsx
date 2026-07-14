import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dbAdapter } from "@/services/dbAdapter";
import { notify } from "@/services/notificationAdapter";
import { Shield, CreditCard, Loader2, CheckCircle2, ArrowRight, Lock } from "lucide-react";

export default function Checkout() {
  const { projectId } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [paying, setPaying] = useState(false);
  const [funded, setFunded] = useState(false);

  useEffect(() => {
    dbAdapter.getProject(projectId).then((proj) => { setP(proj); if (proj.funded) setFunded(true); }).catch(() => {});

    // Returning from Square's hosted checkout: confirm, then fund.
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (sessionId || params.get("paid")) {
      setPaying(true);
      dbAdapter.confirmCardCheckout(projectId, sessionId)
        .then(() => { setFunded(true); notify.success("Payment received", "Your project is now live in the marketplace."); })
        .catch(() => notify.urgent("We couldn't confirm that payment yet"))
        .finally(() => { setPaying(false); window.history.replaceState({}, "", `/customer/checkout/${projectId}`); });
    } else if (params.get("canceled") || params.get("failed")) {
      notify.urgent("Payment was not completed");
      window.history.replaceState({}, "", `/customer/checkout/${projectId}`);
    }
  }, [projectId]);

  // On funding, take a brief celebratory beat then whisk them into the live bid room.
  useEffect(() => {
    if (!funded) return;
    const t = setTimeout(() => nav(`/customer/bids/${projectId}`), 1500);
    return () => clearTimeout(t);
  }, [funded, projectId, nav]);

  const fund = async () => {
    setPaying(true);
    try {
      const { url } = await dbAdapter.createCardCheckout(projectId);
      window.location.href = url;
    } catch (err) {
      notify.urgent(err.response?.data?.detail || "Card payments aren't available right now");
      setPaying(false);
    }
  };

  if (!p) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><div className="card-dark w-full max-w-2xl h-96 mx-4 animate-pulse" /></div>;

  const rows = [
    ["Category", p.category], ["Platform", p.platform], ["Output", p.output_length],
    ["Ratio", p.aspect_ratio], ["Captions", p.captions], ["Mood", p.mood],
    ["Moment", p.moment_mode === "known" ? "Timestamp provided" : "Find the best moment"],
    ["Source", p.source_link],
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
        {/* Brief */}
        <div className="card-dark p-6 sm:p-8 min-w-0">
          <span className="label-caps">Project brief - review before you fund</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tighter mt-2 mb-4 break-words" data-testid="checkout-title">{p.title}</h1>
          {p.description && <p className="text-sm text-zinc-400 mb-6 leading-relaxed break-words">{p.description}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-6">
            {rows.map(([l, v]) => (
              <div key={l} className="bg-black/40 rounded-lg p-3 min-w-0">
                <span className="text-zinc-500 block mb-0.5">{l}</span>
                <span className="font-bold block truncate" title={v || "-"}>{v || "-"}</span>
              </div>
            ))}
          </div>
          <div className="bg-black/40 rounded-xl p-4 flex gap-3 items-start">
            <Shield className="w-5 h-5 text-[#CCFF00] shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-400 leading-relaxed">
              <span className="text-white font-bold">Deadline Bond: ${p.bond}.</span> The clipper you accept locks this behind your deadline. If they miss the 24-hour clock, you get a full refund and their bond is credited to you.
            </p>
          </div>
        </div>

        {/* Payment */}
        <div className="card-dark p-6 sm:p-8 lg:sticky lg:top-24">
          <span className="label-caps">Checkout</span>

          <div className="flex justify-between items-center py-4 mt-2 border-t border-white/10">
            <span className="text-sm text-zinc-400">Budget</span>
            <span className="font-mono font-extrabold text-2xl text-[#CCFF00]" data-testid="checkout-total">${p.budget}</span>
          </div>
          <div className="flex justify-between items-center pb-4 border-b border-white/10">
            <span className="text-sm text-zinc-400">Held in escrow</span>
            <span className="text-xs text-zinc-500">Released on your approval</span>
          </div>

          {!funded ? (
            <>
              <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4 flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0"><CreditCard className="w-4 h-4 text-[#CCFF00]" /></span>
                <div className="min-w-0">
                  <div className="font-bold text-sm">Pay by card</div>
                  <div className="text-xs text-zinc-500 truncate">Visa, Mastercard, Amex, Apple Pay &amp; Google Pay</div>
                </div>
              </div>

              <button data-testid="fund-project-btn" className="btn-lime h-13 w-full text-base mt-5" disabled={paying} onClick={fund}>
                {paying ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : <>Fund Project - ${p.budget} <ArrowRight className="w-4 h-4" /></>}
              </button>

              <p className="text-[11px] text-zinc-600 text-center mt-3 flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3" /> Secured by Square. Released to the clipper only when you approve.
              </p>
            </>
          ) : (
            <div className="py-8 text-center" data-testid="funded-state">
              <CheckCircle2 className="w-12 h-12 text-[#CCFF00] mx-auto mb-3" />
              <p className="font-display font-extrabold text-xl mb-1">Funded &amp; Live</p>
              <p className="text-xs text-zinc-500 mb-6 flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-[#CCFF00]" /> Taking you to the live bid room…</p>
              <button data-testid="goto-bid-room-btn" className="text-sm font-semibold text-[#CCFF00] hover:underline inline-flex items-center gap-1" onClick={() => nav(`/customer/bids/${p.id}`)}>Go now <ArrowRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
