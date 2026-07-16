import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { dbAdapter } from "@/services/dbAdapter";
import { realtimeAdapter } from "@/services/realtimeAdapter";
import { notify } from "@/services/notificationAdapter";
import { Star, Timer, MessageCircle, Check, Loader2, Zap, Play, Shield, Sparkles, Link2, BadgeCheck, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import BidChat from "@/components/BidChat";

function fitScore(bid, budget) {
  const c = bid.clipper || {};
  const priceFit = 1 - Math.min(1, Math.abs(bid.amount - budget * 0.9) / budget);
  return (c.rating || 4) * 12 + (c.on_time_pct || 90) * 0.4 + priceFit * 20 - bid.eta_hours * 0.5;
}

export default function BidRoom() {
  const { projectId } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const [bids, setBids] = useState([]);
  const [selected, setSelected] = useState([]);
  const [multi, setMulti] = useState(false); // explicit multi-accept mode (off = one-tap single accept)
  const [sort, setSort] = useState("fit"); // fit | price | eta
  const [confirming, setConfirming] = useState(false);
  const [accepting, setAccepting] = useState(null); // null | "sending" | "live"
  const [chatBid, setChatBid] = useState(null);
  const [submission, setSubmission] = useState(null);

  useEffect(() => {
    dbAdapter.getProject(projectId).then(setProject).catch(() => {});
    dbAdapter.getBids(projectId).then(setBids).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (!project || project.status !== "open") return;
    const unsub = realtimeAdapter.subscribeToBids(project, bids.map((b) => b.id), (bid) => {
      setBids((prev) => (prev.some((x) => x.id === bid.id) ? prev : [bid, ...prev]));
      notify.info("New bid arrived", `${bid.clipper?.name} bid $${bid.amount}`);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const ranked = useMemo(() => {
    const budget = project?.budget || 100;
    const cmp = {
      fit: (a, b) => fitScore(b, budget) - fitScore(a, budget),
      price: (a, b) => a.amount - b.amount,           // lowest first
      eta: (a, b) => a.eta_hours - b.eta_hours,       // fastest first
    }[sort];
    return [...bids].sort(cmp);
  }, [bids, project, sort]);
  const topLabel = { fit: "BEST FIT", price: "LOWEST", eta: "FASTEST" }[sort];
  const selectedBids = bids.filter((b) => selected.includes(b.id));
  const total = selectedBids.reduce((s, b) => s + b.amount, 0);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Single-accept fast path: one tap on "Accept Bid" jumps straight to confirm.
  const acceptOne = (b) => { setSelected([b.id]); setConfirming(true); };

  const copyLink = () => {
    const url = `${window.location.origin}/clipper/job/${projectId}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => notify.success("Job link copied", "Share it with clippers to pull in bids."))
        .catch(() => notify.info("Share this link", url));
    } else {
      notify.info("Share this link", url);
    }
  };

  const confirm = async () => {
    setAccepting("sending");
    try {
      // Accept every selected clipper - each becomes a live contract instantly.
      for (const b of selectedBids) await dbAdapter.acceptBid(b.id);
      setConfirming(false);
      setAccepting("live");
      setTimeout(() => nav("/customer"), 2000);
    } catch {
      notify.urgent("Could not accept bid");
      setAccepting(null);
    }
  };

  if (!project) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#CCFF00]" /></div>;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-[1fr_1.6fr] gap-8 items-start">
        {/* Left: project summary */}
        <div className="card-dark overflow-hidden lg:sticky lg:top-24">
          <div className="relative aspect-video">
            <img src={project.thumbnail} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CCFF00]">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#CCFF00] opacity-70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#CCFF00]" /></span>
                Live
              </span>
              {project.official && <span title="Verified platform listing" className="inline-flex items-center gap-1 rounded-full bg-[#CCFF00] px-2.5 py-1 text-[10px] font-extrabold text-black"><BadgeCheck className="w-3 h-3" /> VERIFIED</span>}
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <h1 className="font-display font-extrabold text-xl sm:text-2xl tracking-tight leading-tight">{project.title}</h1>
            </div>
          </div>
          <div className="p-5">
            {project.description && <p className="text-sm text-zinc-400 leading-relaxed mb-5">{project.description}</p>}

            <div className="flex items-center justify-between rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.05] px-5 py-4 mb-4">
              <div>
                <div className="label-caps">Budget</div>
                <div className="font-mono font-extrabold text-3xl text-[#CCFF00] mt-0.5">${project.budget}</div>
              </div>
              <div className="text-right text-xs text-zinc-400 space-y-1.5">
                <div className="flex items-center gap-1.5 justify-end"><Shield className="w-3.5 h-3.5 text-[#CCFF00]" /> Bond ${project.bond}</div>
                <div className="flex items-center gap-1.5 justify-end"><Timer className="w-3.5 h-3.5" /> {project.deadline_hours || 24}h to deliver</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[["Output", project.output_length], ["Aspect", project.aspect_ratio], ["Captions", project.captions], ["Platform", project.platform], ["Source", project.source_length], ["Moment", project.moment_mode === "known" ? "Timestamps given" : "Find best moment"]].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{l}</div>
                  <div className="text-sm font-bold truncate" title={v || "-"}>{v || "-"}</div>
                </div>
              ))}
            </div>

            {project.quality_notes && (
              <div className="mt-4">
                <div className="label-caps mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#CCFF00]" /> Quality bar &amp; taste</div>
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line bg-black/30 rounded-xl p-3">{project.quality_notes}</p>
              </div>
            )}

            {project.references?.length > 0 && (
              <div className="mt-4">
                <div className="label-caps mb-2">Reference clips</div>
                <div className="space-y-1.5">
                  {project.references.map((r, i) => (
                    <a key={i} href={r} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-[#CCFF00] hover:underline"><Link2 className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{r}</span></a>
                  ))}
                </div>
              </div>
            )}

            <button onClick={copyLink} className="btn-ghost h-10 w-full text-xs mt-4"><Copy className="w-3.5 h-3.5" /> Copy job link to share</button>
          </div>
        </div>

        {/* Right: live bids */}
        <div>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-baseline gap-3">
              <h2 className="font-display font-extrabold text-2xl tracking-tight">Live Bid Room</h2>
              <span className="text-sm text-zinc-500">{bids.length} bid{bids.length === 1 ? "" : "s"}</span>
            </div>
            {bids.length > 0 && (
              <button data-testid="multi-select-toggle" onClick={() => { setMulti((m) => !m); setSelected([]); }}
                className={`text-xs font-bold transition-colors ${multi ? "text-[#CCFF00]" : "text-zinc-500 hover:text-white"}`}>
                {multi ? "Done selecting" : "Accept multiple"}
              </button>
            )}
          </div>
          {/* Sort control - transparent ranking the customer controls */}
          {bids.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs text-zinc-500 mr-1">Sort by</span>
              {[["fit", "Best fit"], ["price", "Lowest price"], ["eta", "Fastest"]].map(([k, label]) => (
                <button key={k} data-testid={`sort-${k}`} onClick={() => setSort(k)}
                  className={`h-8 px-3.5 rounded-full text-xs font-bold border transition-colors ${sort === k ? "bg-[#CCFF00] text-black border-transparent" : "border-white/10 text-zinc-400 hover:text-white hover:border-white/25"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-4" data-testid="bid-list">
            <AnimatePresence initial={false}>
              {ranked.map((b, idx) => (
                <motion.div key={b.id} layout initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  className={`card-dark p-5 ${selected.includes(b.id) ? "border-[#CCFF00]" : ""}`} data-testid={`bid-card-${b.id}`}>
                  <div className="flex gap-4 flex-wrap">
                    <img src={b.clipper?.avatar} alt="" className="w-12 h-12 rounded-full" />
                    <div className="flex-1 min-w-40">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold">{b.clipper?.name}</span>
                        {idx === 0 && <span className="text-[10px] font-bold bg-[#CCFF00] text-black rounded-full px-2 py-0.5">{topLabel}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-[#CCFF00]" fill="#CCFF00" />{b.clipper?.rating}</span>
                        <span className="flex items-center gap-1 text-[#CCFF00]"><Timer className="w-3 h-3" />{b.clipper?.on_time_pct}% on-time</span>
                        <span>ETA {b.eta_hours}h</span>
                      </div>
                      {b.clipper?.id && (
                        <Link to={`/clippers/${b.clipper.id}`} target="_blank" data-testid={`view-clipper-${b.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-white transition-colors mt-1.5">
                          <BadgeCheck className="w-3.5 h-3.5" /> View profile &amp; portfolio
                        </Link>
                      )}
                      <p className="text-sm text-zinc-300 mt-2 italic">“{b.pitch}”</p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-extrabold text-2xl text-[#CCFF00]">${b.amount}</div>
                      <div className="text-[10px] text-zinc-500">Bond ${b.bond_required}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    {b.clipper?.portfolio?.[0]?.video_url?.endsWith(".mp4") ? (
                      <button data-testid={`submission-bid-${b.id}`} onClick={() => setSubmission({ url: b.clipper.portfolio[0].video_url, name: b.clipper.name })}
                        className="relative w-24 aspect-video rounded-lg overflow-hidden shrink-0 border border-[#CCFF00]/50" title="View submission">
                        <img src={b.clipper.portfolio[0].thumb} alt="" className="w-full h-full object-cover" />
                        <span className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center"><Play className="w-4 h-4" fill="white" /><span className="text-[8px] font-bold text-[#CCFF00] mt-0.5">SUBMISSION</span></span>
                      </button>
                    ) : b.clipper?.portfolio?.[0] && (
                      <div className="relative w-24 aspect-video rounded-lg overflow-hidden shrink-0">
                        <img src={b.clipper.portfolio[0].thumb} alt="" className="w-full h-full object-cover" />
                        <span className="absolute inset-0 bg-black/40 flex items-center justify-center"><Play className="w-4 h-4" fill="white" /></span>
                      </div>
                    )}
                    <button data-testid={`message-bid-${b.id}`} className="btn-ghost h-10 px-4 text-xs ml-auto" onClick={() => setChatBid(b)}><MessageCircle className="w-3.5 h-3.5" /> Message</button>
                    <button data-testid={`accept-bid-${b.id}`} onClick={() => (multi ? toggle(b.id) : acceptOne(b))}
                      className={`h-10 px-5 text-xs font-bold rounded-full transition-colors active:scale-95 ${multi && selected.includes(b.id) ? "bg-[#CCFF00] text-black" : "bg-white text-black hover:bg-zinc-200"}`}>
                      {multi && selected.includes(b.id) ? <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Selected</span> : "Accept Bid"}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {ranked.length === 0 && (
              <div className="card-dark p-8 sm:p-10 text-center" data-testid="bids-empty">
                <div className="w-14 h-14 rounded-2xl bg-[#CCFF00]/[0.08] border border-[#CCFF00]/25 flex items-center justify-center mx-auto mb-4">
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#CCFF00] opacity-60" />
                    <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#CCFF00]" />
                  </span>
                </div>
                <p className="font-display font-extrabold text-xl">Your job is live</p>
                <p className="text-sm text-zinc-400 mt-1.5 max-w-sm mx-auto">Vetted clippers can see it now. New bids appear here automatically - no need to refresh.</p>
                <div className="grid sm:grid-cols-3 gap-3 mt-6 text-left">
                  {[["1", "Clippers review", "They read your brief, budget and footage."], ["2", "Bids roll in", "Each with a price, ETA and pitch."], ["3", "You pick", "Accept one and the 24-hour clock starts."]].map(([n, t, d]) => (
                    <div key={n} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                      <div className="font-mono font-extrabold text-[#CCFF00]/50 mb-1">{n}</div>
                      <div className="text-sm font-bold">{t}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{d}</div>
                    </div>
                  ))}
                </div>
                <button onClick={copyLink} className="btn-ghost h-11 px-6 text-sm mt-6"><Copy className="w-3.5 h-3.5" /> Copy job link to share</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky selection bar - only in explicit multi-accept mode */}
      {multi && selected.length > 0 && !accepting && (
        <motion.div initial={{ y: 80 }} animate={{ y: 0 }} className="fixed bottom-0 inset-x-0 bg-[#121212] border-t border-[#CCFF00]/40 p-4 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div>
              <span className="font-display font-bold">{selected.length} clipper{selected.length > 1 ? "s" : ""} selected</span>
              <span className="text-zinc-500 text-sm ml-3">Combined total: <span className="font-mono font-extrabold text-[#CCFF00]">${total}</span></span>
            </div>
            <button data-testid="confirm-selection-btn" className="btn-lime h-12 px-8" onClick={() => setConfirming(true)}>Confirm & Start Contract <Zap className="w-4 h-4" /></button>
          </div>
        </motion.div>
      )}

      {/* Chat with a bidder (before accepting) */}
      <Dialog open={!!chatBid} onOpenChange={(o) => !o && setChatBid(null)}>
        <DialogContent className="bg-[#1A1A1A] border-white/10 text-white">
          <DialogTitle className="flex items-center gap-2 font-display font-extrabold text-lg">
            <img src={chatBid?.clipper?.avatar} alt="" className="w-7 h-7 rounded-full" />
            Chat with {chatBid?.clipper?.name}
          </DialogTitle>
          <p className="-mt-1 text-xs text-zinc-500">Align on the brief before you accept - bid ${chatBid?.amount} · ETA {chatBid?.eta_hours}h</p>
          {chatBid && <BidChat bidId={chatBid.id} meSender="customer" otherName={chatBid.clipper?.name} />}
        </DialogContent>
      </Dialog>

      {/* Submission viewer */}
      <Dialog open={!!submission} onOpenChange={(o) => !o && setSubmission(null)}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-sm">
          <DialogTitle className="font-display font-extrabold text-lg flex items-center gap-2"><span className="badge-live">SUBMISSION</span> {submission?.name}</DialogTitle>
          {submission && <video src={submission.url} className="w-full rounded-xl bg-black max-h-[70vh]" controls autoPlay />}
        </DialogContent>
      </Dialog>

      {/* Confirm modal - the single primary action for accepting */}
      <Dialog open={confirming} onOpenChange={(o) => { if (accepting !== "sending") setConfirming(o); }}>
        <DialogContent className="bg-[#1A1A1A] border-white/10 text-white">
          <DialogTitle className="font-display font-extrabold text-xl">Confirm your clipper{selectedBids.length > 1 ? "s" : ""}</DialogTitle>
          {selectedBids.map((b) => (
            <div key={b.id} className="flex justify-between items-center py-2 border-b border-white/10 text-sm">
              <span>{b.clipper?.name}</span><span className="font-mono font-bold text-[#CCFF00]">${b.amount}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-2 font-bold"><span>Combined project total</span><span className="font-mono text-xl text-[#CCFF00]" data-testid="combined-total">${total}</span></div>
          <p className="text-xs text-zinc-500">Each clipper must accept and lock their Deadline Bond before their 24-hour clock starts.</p>
          {accepting === "sending" ? (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-zinc-400" data-testid="awaiting-clipper-state">
              <Loader2 className="w-4 h-4 animate-spin text-[#CCFF00]" /> Locking the Deadline Bond…
            </div>
          ) : (
            <button data-testid="final-confirm-btn" className="btn-lime h-12 w-full" onClick={confirm}>Send acceptance</button>
          )}
        </DialogContent>
      </Dialog>

      {/* Contract live overlay - single celebratory beat, then dashboard */}
      <Dialog open={accepting === "live"}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 text-white text-center [&>button]:hidden">
          <DialogTitle className="sr-only">Contract status</DialogTitle>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-8" data-testid="contract-live-state">
            <Zap className="w-12 h-12 text-[#CCFF00] mx-auto mb-4" fill="#CCFF00" />
            <p className="font-display font-extrabold text-3xl tracking-tighter text-[#CCFF00] mb-2">CONTRACT LIVE</p>
            <p className="text-sm text-zinc-400">Bond locked. Footage confirmed. The 24-hour clock starts now.</p>
            <div className="font-mono font-extrabold text-4xl mt-4">24:00:00</div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
