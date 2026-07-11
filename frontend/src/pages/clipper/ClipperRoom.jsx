import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { dbAdapter } from "@/services/dbAdapter";
import { paymentAdapter } from "@/services/paymentAdapter";
import { storageAdapter } from "@/services/storageAdapter";
import { notify } from "@/services/notificationAdapter";
import Countdown from "@/components/Countdown";
import StatusBadge from "@/components/StatusBadge";
import ChatPanel from "@/components/ChatPanel";
import { Lock, FileVideo, Upload, CheckCircle2, RefreshCw } from "lucide-react";

export default function ClipperRoom() {
  const { contractId } = useParams();
  const [c, setC] = useState(null);
  const [pct, setPct] = useState(null);
  const [note, setNote] = useState("");

  const load = () => dbAdapter.getContract(contractId).then(setC).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [contractId]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPct(0);
    const res = await storageAdapter.upload(file, setPct, { kind: "delivery", contractId });
    await dbAdapter.deliver(contractId, { note: note || `First cut — ${file.name}`, key: res.key });
    setPct(null);
    setNote("");
    notify.success("Delivery submitted", "The customer has been notified. Clock stopped.");
    load();
  };

  const downloadSource = async () => {
    try {
      const url = await storageAdapter.projectSourceUrl(c.project_id);
      window.open(url, "_blank");
    } catch {
      notify.urgent("Source footage isn't available to download");
    }
  };

  if (!c) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><div className="card-dark w-full max-w-4xl h-96 mx-4 animate-pulse" /></div>;
  const p = c.project || {};
  const fee = paymentAdapter.successFee(c.price);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="card-dark p-8 mb-8 text-center" data-testid="clipper-room-countdown">
          <div className="flex items-center justify-center gap-3 mb-4 flex-wrap"><StatusBadge status={c.status} /><span className="text-xs text-zinc-500">{p.title}</span></div>
          {c.status === "live" || c.status === "revision" ? (
            <>
              <Countdown deadline={c.deadline_at} size="lg" />
              <p className="label-caps mt-4">{c.status === "revision" ? "Revision requested — resubmit before the clock hits zero" : "Deliver your first cut before the clock hits zero"}</p>
            </>
          ) : c.status === "delivered" ? (
            <p className="font-display font-extrabold text-2xl text-[#CCFF00]">Delivered — awaiting customer review</p>
          ) : c.status === "rescue" ? (
            <div>
              <p className="font-display font-extrabold text-2xl text-[#FF4500]">DEADLINE MISSED — RESCUE MODE</p>
              <p className="text-sm text-zinc-400 mt-2">Your ${c.bond} bond was credited to the customer. This counts as a missed-deadline strike.</p>
            </div>
          ) : (
            <p className="font-display font-extrabold text-2xl text-[#CCFF00]">Completed — payment released</p>
          )}
        </div>

        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          <div className="space-y-6">
            <div className="card-dark p-6">
              <div className="flex items-center gap-2 mb-4"><Lock className="w-4 h-4 text-zinc-500" /><span className="label-caps">Locked brief</span></div>
              <h2 className="font-display font-extrabold text-xl mb-2">{p.title}</h2>
              <p className="text-sm text-zinc-400 mb-4">{p.description}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[["Output", p.output_length], ["Ratio", p.aspect_ratio], ["Captions", p.captions], ["Mood", p.mood]].map(([l, v]) => (
                  <div key={l} className="bg-black/40 rounded-lg p-3"><span className="text-zinc-500 block">{l}</span><span className="font-bold">{v}</span></div>
                ))}
              </div>
              <div className="flex items-center gap-3 bg-black/40 rounded-xl p-4 mt-4">
                <FileVideo className="w-5 h-5 text-[#CCFF00]" />
                <div className="flex-1"><p className="text-sm font-bold">{p.source_link}</p><p className="text-xs text-zinc-500">Source footage · {p.source_length}</p></div>
                {p.source_key && (
                  <button onClick={downloadSource} data-testid="download-source-btn" className="btn-ghost h-9 px-4 text-xs shrink-0">Download source</button>
                )}
              </div>
            </div>

            {/* Upload */}
            {(c.status === "live" || c.status === "revision") && (
              <div className="card-dark p-6" data-testid="upload-cut-panel">
                <span className="label-caps block mb-4">{c.status === "revision" ? "Upload revised cut" : "Upload first cut"}</span>
                {c.status === "revision" && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 mb-3"><RefreshCw className="w-4 h-4" /> The customer requested changes — check chat for details.</div>
                )}
                <input className="input-dark text-sm mb-3" data-testid="delivery-note-input" placeholder="Delivery note (what you changed, choices you made)" value={note} onChange={(e) => setNote(e.target.value)} />
                <label className="card-dark border-dashed p-8 text-center cursor-pointer hover:border-[#CCFF00]/40 transition-colors block">
                  <input type="file" className="hidden" onChange={upload} data-testid="upload-cut-input" />
                  <Upload className="w-6 h-6 mx-auto mb-2 text-[#CCFF00]" />
                  <span className="text-sm font-bold">{pct !== null ? `Uploading… ${pct}%` : "Drop your cut here or click to upload"}</span>
                  {pct !== null && <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-[#CCFF00] transition-[width]" style={{ width: `${pct}%` }} /></div>}
                </label>
              </div>
            )}

            {c.versions.length > 0 && (
              <div className="card-dark p-6">
                <span className="label-caps block mb-4">Your submissions</span>
                {c.versions.map((v) => (
                  <div key={v.num} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#CCFF00]" />
                    <span className="font-bold">Version {v.num}</span>
                    <span className="text-zinc-500 text-xs truncate">{v.note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card-dark p-6" data-testid="payout-summary">
              <span className="label-caps block mb-3">Payout summary</span>
              {[["Project value", `$${c.price}`], ["Platform fee (8%)", `-$${fee}`], ["Deadline Bond", c.status === "completed" ? `$${c.bond} returned` : `$${c.bond} locked`]].map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm py-1.5 border-b border-white/5"><span className="text-zinc-500">{l}</span><span className="font-mono font-bold">{v}</span></div>
              ))}
              <div className="flex justify-between py-3 font-bold"><span>You receive</span><span className="font-mono text-xl text-[#CCFF00]">${paymentAdapter.payout(c.price)}</span></div>
            </div>
            <div className="card-dark p-6">
              <span className="label-caps block mb-4">Chat with customer</span>
              <ChatPanel contractId={c.id} me="clipper" other="Customer" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
