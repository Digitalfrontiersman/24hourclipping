import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { dbAdapter } from "@/services/dbAdapter";
import { solanaAdapter } from "@/services/solanaAdapter";
import { notify } from "@/services/notificationAdapter";
import Countdown from "@/components/Countdown";
import StatusBadge from "@/components/StatusBadge";
import ChatPanel from "@/components/ChatPanel";
import { Lock, FileVideo, Link2, ShieldCheck, LifeBuoy, ExternalLink, History, ArrowRight } from "lucide-react";

export default function ClipRoom() {
  const { contractId } = useParams();
  const [c, setC] = useState(null);

  const load = () => dbAdapter.getContract(contractId).then(setC).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [contractId]);

  if (!c) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><div className="card-dark w-full max-w-4xl h-96 mx-4 animate-pulse" /></div>;
  const p = c.project || {};

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Countdown hero */}
        <div className="card-dark p-8 mb-8 text-center relative overflow-hidden" data-testid="clip-room-countdown">
          <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
            <StatusBadge status={c.status} />
            <span className="text-xs text-zinc-500">{p.title} · {c.clipper?.name}</span>
          </div>
          {c.status === "live" || c.status === "revision" ? (
            <>
              <Countdown deadline={c.deadline_at} size="lg" />
              <p className="label-caps mt-4">Time remaining until first cut is due</p>
            </>
          ) : c.status === "rescue" ? (
            <div data-testid="rescue-mode-panel">
              <p className="font-mono text-6xl font-extrabold text-[#FF4500] tracking-tighter">00:00:00</p>
              <p className="font-display font-extrabold text-2xl text-[#FF4500] mt-4">RESCUE MODE</p>
              <p className="text-sm text-zinc-400 max-w-md mx-auto mt-2">The deadline passed without a qualifying first cut. Your ${c.price} is refunded and the ${c.bond} Deadline Bond is credited to your account.</p>
              <button data-testid="rescue-relaunch-btn" className="btn-coral h-12 px-8 mt-6" onClick={() => dbAdapter.relaunch(c.id).then(() => { notify.success("Relaunched as priority job"); load(); })}>Relaunch as Priority Job</button>
            </div>
          ) : (
            <p className="font-display font-extrabold text-3xl text-[#CCFF00]">{c.status === "delivered" ? "First cut delivered — review it now" : "Project completed"}</p>
          )}
          {c.status === "delivered" && (
            <Link to={`/customer/review/${c.id}`} data-testid="goto-review-btn" className="btn-lime h-12 px-8 mt-6 inline-flex">Review Delivery <ArrowRight className="w-4 h-4" /></Link>
          )}
        </div>

        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          <div className="space-y-6">
            {/* Locked brief */}
            <div className="card-dark p-6">
              <div className="flex items-center gap-2 mb-4"><Lock className="w-4 h-4 text-zinc-500" /><span className="label-caps">Locked project brief</span></div>
              <h2 className="font-display font-extrabold text-xl mb-2">{p.title}</h2>
              <p className="text-sm text-zinc-400 mb-4">{p.description}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[["Output", p.output_length], ["Ratio", p.aspect_ratio], ["Captions", p.captions], ["Platform", p.platform]].map(([l, v]) => (
                  <div key={l} className="bg-black/40 rounded-lg p-3"><span className="text-zinc-500 block">{l}</span><span className="font-bold">{v}</span></div>
                ))}
              </div>
            </div>

            {/* Source + versions */}
            <div className="card-dark p-6">
              <span className="label-caps block mb-4">Source files & links</span>
              <div className="flex items-center gap-3 bg-black/40 rounded-xl p-4 mb-2">
                <FileVideo className="w-5 h-5 text-[#CCFF00]" />
                <div className="flex-1"><p className="text-sm font-bold">{p.source_link || "Source footage"}</p><p className="text-xs text-zinc-500">Source length {p.source_length || "—"}</p></div>
                <Link2 className="w-4 h-4 text-zinc-500" />
              </div>
            </div>

            <div className="card-dark p-6" data-testid="version-history">
              <div className="flex items-center gap-2 mb-4"><History className="w-4 h-4 text-zinc-500" /><span className="label-caps">Version history & preview</span></div>
              {c.versions.length === 0 ? (
                <p className="text-sm text-zinc-600">No versions yet. The clipper is working — the first cut will land here.</p>
              ) : c.versions.map((v) => (
                <div key={v.num} className="mb-4 last:mb-0">
                  <video controls className="w-full rounded-xl border border-white/10 mb-2 max-h-72 bg-black" src={v.url} />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">Version {v.num}</span><span className="text-zinc-500">{v.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Status card */}
            <div className="card-dark p-6 space-y-3">
              <span className="label-caps block">Contract status</span>
              {[["Project value", `$${c.price}`], ["Deadline Bond", `$${c.bond} locked`], ["Delivery status", c.status.replace("_", " ")]].map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm py-1.5 border-b border-white/5 last:border-0"><span className="text-zinc-500">{l}</span><span className="font-mono font-bold capitalize">{v}</span></div>
              ))}
              <a data-testid="solana-verify-link" href={solanaAdapter.explorerUrl(c.tx_hash)} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-xs text-[#CCFF00] hover:underline pt-2">
                <ShieldCheck className="w-4 h-4" /> Verified on Solana <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Chat */}
            <div className="card-dark p-6">
              <span className="label-caps block mb-4">Chat with {c.clipper?.name?.split(" ")[0]}</span>
              <ChatPanel contractId={c.id} me="customer" other={c.clipper?.name?.split(" ")[0]} />
            </div>

            <button data-testid="request-help-btn" className="btn-ghost h-12 w-full" onClick={() => notify.success("Help request sent", "Our team responds within 15 minutes on live contracts")}>
              <LifeBuoy className="w-4 h-4" /> Request Help
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
