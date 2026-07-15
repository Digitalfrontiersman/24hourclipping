import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { dbAdapter, bondFor } from "@/services/dbAdapter";
import { notify } from "@/services/notificationAdapter";
import { Shield, ArrowLeft, CheckCircle2, MessageCircle, Link2, Clock, Sparkles, Zap, SlidersHorizontal, BadgeCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";
import BidChat from "@/components/BidChat";

const QUICK_PITCHES = [
  "Scroll-stopping hook in the first 2s, bold captions, delivered early.",
  "I specialize in this category - punchy pacing, on-brand, on-time.",
  "Clean premium edit with beat-synced cuts. Guaranteed on-time.",
];

export default function JobDetails() {
  const { projectId } = useParams();
  const { user } = useApp();
  const ME = user?.id;
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [amount, setAmount] = useState("");
  const [eta, setEta] = useState(12);
  // Prefill a sensible pitch so "Place Bid" works in a single tap. Editing stays
  // optional - the quick-pitch chips and the field below still overwrite it.
  const [pitch, setPitch] = useState(QUICK_PITCHES[0]);
  const [portfolioIdx, setPortfolioIdx] = useState(0);
  const [me, setMe] = useState(null);
  const [placed, setPlaced] = useState(false);
  const [placedBid, setPlacedBid] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [customize, setCustomize] = useState(false); // one-tap Quick Apply by default

  useEffect(() => {
    dbAdapter.getProject(projectId).then((proj) => { setP(proj); setAmount(Math.round(proj.budget * 0.9)); }).catch(() => {});
    if (ME) dbAdapter.getClipper(ME).then(setMe).catch(() => {});
  }, [projectId, ME]);

  const submit = async () => {
    if (submitting) return;
    if (!amount || !pitch.trim()) return notify.urgent("Add a bid price and a one-line pitch");
    setSubmitting(true);
    try {
      const bid = await dbAdapter.createBid(projectId, { amount: Number(amount), pitch, eta_hours: Number(eta) });
      setPlacedBid(bid);
      setPlaced(true);
      notify.success("Bid placed", "You'll be notified the moment the customer responds");
    } catch (err) {
      notify.urgent(err.response?.data?.detail || "Could not place bid", "Please try again");
      setSubmitting(false);
    }
  };

  if (!p) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><div className="card-dark w-full max-w-3xl h-96 mx-4 animate-pulse" /></div>;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/marketplace" className="text-sm text-zinc-500 hover:text-white flex items-center gap-2 mb-6 transition-colors"><ArrowLeft className="w-4 h-4" /> Live jobs</Link>
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
          <div className="card-dark overflow-hidden">
            <div className="relative aspect-video">
              <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-bold">{p.category}</span>
                  {p.official && <span title="Verified platform listing" className="inline-flex items-center gap-1 rounded-full bg-[#CCFF00] px-2.5 py-1 text-[10px] font-extrabold text-black"><BadgeCheck className="w-3 h-3" /> VERIFIED</span>}
                </div>
                <h1 className="font-display font-extrabold text-2xl tracking-tight mt-2">{p.title}</h1>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-zinc-400 mb-5">{p.description}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {[["Budget", `$${p.budget}`], ["Source", p.source_length], ["Output", p.output_length], ["Ratio", p.aspect_ratio], ["Captions", p.captions], ["Moment", p.timestamp_provided ? "Timestamps given" : "Find best moment"]].map(([l, v]) => (
                  <div key={l} className="bg-black/40 rounded-lg p-3"><span className="text-zinc-500 block">{l}</span><span className="font-bold">{v}</span></div>
                ))}
              </div>

              {p.quality_notes && (
                <div className="mt-5">
                  <div className="label-caps mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#CCFF00]" /> Quality bar & taste</div>
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line bg-black/30 rounded-xl p-4">{p.quality_notes}</p>
                </div>
              )}

              {p.references?.length > 0 && (
                <div className="mt-5">
                  <div className="label-caps mb-2">Reference clips the creator loves</div>
                  <div className="space-y-1.5">
                    {p.references.map((r, i) => (
                      <a key={i} href={r} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-[#CCFF00] hover:underline">
                        <Link2 className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{r}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {p.allow_extension && (
                <div className="mt-5 flex items-center gap-2 text-xs text-[#CCFF00] bg-[#CCFF00]/[0.06] border border-[#CCFF00]/20 rounded-xl px-3 py-2.5">
                  <Clock className="w-4 h-4 shrink-0" /> Flexible deadline - the creator lets you extend if you need more time.
                </div>
              )}
            </div>
          </div>

          <div className="card-dark p-6 lg:sticky lg:top-24" data-testid="bid-form">
            {!placed ? (
              <>
                <h2 className="font-display font-extrabold text-xl mb-5">Place your bid</h2>

                {!customize ? (
                  <div data-testid="quick-apply-panel">
                    <p className="text-sm text-zinc-400 mb-4">One tap to bid with your smart defaults. Nothing locks until the creator accepts.</p>
                    <div className="rounded-xl bg-black/40 p-4 mb-4 space-y-2.5">
                      <div className="flex items-center justify-between"><span className="text-xs text-zinc-500">Your bid</span><span className="font-mono font-extrabold text-xl text-[#CCFF00]">${amount || Math.round(p.budget * 0.9)}</span></div>
                      <div className="flex items-center justify-between"><span className="text-xs text-zinc-500">First cut in</span><span className="font-mono font-bold">{eta}h</span></div>
                      <div className="border-t border-white/10 pt-2.5"><span className="text-xs text-zinc-500 block mb-1">Pitch</span><span className="text-sm text-zinc-300 italic">“{pitch}”</span></div>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 flex items-start gap-2 mb-4">
                      <Shield className="w-4 h-4 text-[#CCFF00] shrink-0 mt-0.5" />
                      <p className="text-xs text-zinc-400">Deadline Bond: <span className="font-mono font-bold text-[#CCFF00]">${bondFor(Number(amount) || p.budget)}</span> - <span className="text-white">not locked now.</span> Locks only if accepted.</p>
                    </div>
                    <button data-testid="quick-apply-btn" disabled={submitting} className="btn-lime w-full h-14 text-base" onClick={submit}>
                      {submitting ? "Applying…" : <>Quick Apply <Zap className="w-4 h-4" fill="black" /></>}
                    </button>
                    <button type="button" data-testid="customize-bid-toggle" className="w-full text-center text-sm text-zinc-500 hover:text-white transition-colors flex items-center justify-center gap-1.5 mt-3" onClick={() => setCustomize(true)}>
                      <SlidersHorizontal className="w-3.5 h-3.5" /> Customize amount, ETA & pitch
                    </button>
                  </div>
                ) : (
                <>
                <label className="label-caps block mb-2">Bid price</label>
                <div className="relative mb-4">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-[#CCFF00]">$</span>
                  <input data-testid="bid-amount-input" type="number" min="20" max="500" className="input-dark pl-8 font-mono font-bold" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <label className="label-caps block mb-2">Estimated first-cut time</label>
                <div className="flex gap-2 mb-4">
                  {[6, 12, 18].map((h) => (
                    <button key={h} data-testid={`eta-${h}`} onClick={() => setEta(h)} className={`flex-1 py-2.5 rounded-xl text-sm font-mono font-bold transition-colors ${eta === h ? "bg-[#CCFF00] text-black" : "bg-white/5 text-zinc-400"}`}>{h}h</button>
                  ))}
                </div>
                <label className="label-caps block mb-2">One-line pitch</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {QUICK_PITCHES.map((qp, i) => (
                    <button key={i} type="button" data-testid={`quick-pitch-${i}`} onClick={() => setPitch(qp)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                      {["Punchy hook", "Category pro", "Premium cut"][i]}
                    </button>
                  ))}
                </div>
                <input data-testid="bid-pitch-input" className="input-dark mb-4 text-sm" placeholder="Tap a suggestion above or write your own" value={pitch} onChange={(e) => setPitch(e.target.value)} maxLength={90} />
                <label className="label-caps block mb-2">Relevant portfolio example</label>
                <div className="flex gap-2 mb-5">
                  {me?.portfolio?.map((port, i) => (
                    <button key={i} onClick={() => setPortfolioIdx(i)} className={`relative w-1/3 aspect-video rounded-lg overflow-hidden border-2 transition-colors ${portfolioIdx === i ? "border-[#CCFF00]" : "border-transparent"}`}>
                      <img src={port.thumb} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <div className="bg-black/40 rounded-xl p-3 flex items-start gap-2 mb-5">
                  <Shield className="w-4 h-4 text-[#CCFF00] shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-400">Required Deadline Bond: <span className="font-mono font-bold text-[#CCFF00]">${bondFor(Number(amount) || p.budget)}</span> - <span className="text-white">not locked now.</span> It locks only if your bid is accepted and you confirm the project.</p>
                </div>
                <button data-testid="place-bid-btn" disabled={submitting} className="btn-lime w-full h-12" onClick={submit}>{submitting ? "Placing bid…" : "Place Bid"}</button>
                <button type="button" className="w-full text-center text-sm text-zinc-500 hover:text-white transition-colors flex items-center justify-center gap-1.5 mt-3" onClick={() => setCustomize(false)}>
                  <Zap className="w-3.5 h-3.5" /> Back to Quick Apply
                </button>
                </>
                )}
              </>
            ) : (
              <div data-testid="bid-placed-state">
                <div className="text-center pt-2 pb-4">
                  <CheckCircle2 className="w-11 h-11 text-[#CCFF00] mx-auto mb-3" />
                  <p className="font-display font-extrabold text-xl mb-1">Bid placed</p>
                  <p className="text-sm text-zinc-500">You're in the room, ranked by Best Fit. No bond locked yet.</p>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="label-caps mb-2 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-[#CCFF00]" /> Message the creator</p>
                  {placedBid && <BidChat bidId={placedBid.id} meSender="clipper" otherName={p.customer_name} />}
                </div>
                <button data-testid="back-to-clipper-dash" className="btn-ghost h-11 w-full mt-4" onClick={() => nav("/clipper")}>Back to dashboard</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
