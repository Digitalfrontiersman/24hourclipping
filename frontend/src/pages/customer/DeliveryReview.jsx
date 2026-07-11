import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { dbAdapter } from "@/services/dbAdapter";
import { paymentAdapter } from "@/services/paymentAdapter";
import { notify } from "@/services/notificationAdapter";
import { Star, Download, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function DeliveryReview() {
  const { contractId } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState(null);
  const [active, setActive] = useState(0);
  const [revising, setRevising] = useState(false);
  const [revText, setRevText] = useState("");
  const [rating, setRating] = useState(5);
  const [approved, setApproved] = useState(null);

  useEffect(() => {
    dbAdapter.getContract(contractId).then((ct) => { setC(ct); setActive(Math.max(0, ct.versions.length - 1)); }).catch(() => {});
  }, [contractId]);

  if (!c) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#CCFF00]" /></div>;
  const v = c.versions[active];

  const requestRevision = async () => {
    if (!revText.trim()) return;
    await dbAdapter.requestRevision(c.id, revText);
    setRevising(false);
    notify.urgent("Revision requested", "The clipper has been notified");
    nav(`/customer/clip-room/${c.id}`);
  };

  const approve = async () => {
    const res = await dbAdapter.approve(c.id, rating);
    setApproved(res);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-[1.6fr_1fr] gap-8 items-start">
        <div>
          <span className="label-caps">Delivery review</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tighter mt-2 mb-6">{c.project?.title}</h1>
          {v ? (
            <video key={v.num} controls autoPlay muted className="w-full rounded-2xl border border-white/10 bg-black max-h-[480px]" src={v.url} data-testid="delivery-video" />
          ) : <div className="card-dark aspect-video flex items-center justify-center text-zinc-600">No delivery yet</div>}

          {/* Version compare */}
          <div className="flex gap-2 mt-4" data-testid="version-tabs">
            {c.versions.map((ver, i) => (
              <button key={ver.num} data-testid={`version-tab-${ver.num}`} onClick={() => setActive(i)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${active === i ? "bg-[#CCFF00] text-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}>
                Version {ver.num}
              </button>
            ))}
          </div>
          {v && <p className="text-sm text-zinc-500 mt-3">{v.note}</p>}
        </div>

        <div className="card-dark p-6 space-y-4 lg:sticky lg:top-24">
          <div className="flex justify-between items-center pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img src={c.clipper?.avatar} alt="" className="w-10 h-10 rounded-full" />
              <div><p className="font-bold text-sm">{c.clipper?.name}</p><p className="text-xs text-zinc-500">{c.clipper?.on_time_pct}% on-time</p></div>
            </div>
            <span className="font-mono font-extrabold text-xl text-[#CCFF00]">${c.price}</span>
          </div>

          <div>
            <span className="label-caps block mb-2">Rate this clipper</span>
            <div className="flex gap-1" data-testid="rating-stars">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} data-testid={`rate-star-${s}`} onClick={() => setRating(s)} aria-label={`${s} stars`}>
                  <Star className={`w-7 h-7 ${s <= rating ? "text-[#CCFF00]" : "text-zinc-700"}`} fill={s <= rating ? "#CCFF00" : "none"} />
                </button>
              ))}
            </div>
          </div>

          <button data-testid="approve-release-btn" className="btn-lime h-14 w-full text-base" onClick={approve}>
            <CheckCircle2 className="w-5 h-5" /> Approve & Release ${c.price}
          </button>
          <button data-testid="request-revision-btn" className="btn-ghost h-12 w-full" onClick={() => setRevising(true)}><RefreshCw className="w-4 h-4" /> Request Revisions</button>
          <button data-testid="download-final-btn" className="btn-white h-12 w-full" onClick={() => { window.open(v?.url, "_blank"); notify.success("Download started"); }}>
            <Download className="w-4 h-4" /> Download Final File
          </button>
          <p className="text-[10px] text-zinc-600 text-center">Approving releases payment minus the 8% success fee and returns the clipper's bond.</p>
        </div>
      </div>

      <Dialog open={revising} onOpenChange={setRevising}>
        <DialogContent className="bg-[#1A1A1A] border-white/10 text-white">
          <h3 className="font-display font-extrabold text-xl">Request revisions</h3>
          <textarea data-testid="revision-text-input" className="input-dark h-28 py-3 text-sm" placeholder="Be specific: 'Tighten the intro to 1.5s, swap the end card…'" value={revText} onChange={(e) => setRevText(e.target.value)} />
          <button data-testid="submit-revision-btn" className="btn-coral h-12 w-full" onClick={requestRevision}>Send Revision Request</button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!approved}>
        <DialogContent className="bg-[#0A0A0A] border-[#CCFF00]/40 text-white text-center [&>button]:hidden">
          <div className="py-6" data-testid="approval-success">
            <CheckCircle2 className="w-14 h-14 text-[#CCFF00] mx-auto mb-4" />
            <p className="font-display font-extrabold text-2xl mb-2">Payment released</p>
            <div className="text-sm text-zinc-400 space-y-1 mb-6">
              <p>Clipper payout: <span className="font-mono font-bold text-white">${approved?.payout}</span></p>
              <p>Platform success fee (8%): <span className="font-mono font-bold text-white">${approved?.fee}</span></p>
              <p>Bond returned to clipper: <span className="font-mono font-bold text-[#CCFF00]">${approved?.bond_returned}</span></p>
            </div>
            <button data-testid="back-to-dashboard-btn" className="btn-lime h-12 w-full" onClick={() => nav("/customer")}>Back to dashboard</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
