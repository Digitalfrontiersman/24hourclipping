import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { solanaAdapter } from "@/services/solanaAdapter";
import { storageAdapter } from "@/services/storageAdapter";
import { notify } from "@/services/notificationAdapter";
import { CATEGORIES } from "@/data/demoVideos";
import { KeyRound, Wallet, Upload, Check, Loader2, Clock, ArrowRight } from "lucide-react";

const TOOLS = ["Premiere Pro", "CapCut", "After Effects", "DaVinci Resolve", "Final Cut"];

export default function ClipperOnboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [wallet, setWallet] = useState(solanaAdapter.getWallet());
  const [connecting, setConnecting] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [pct, setPct] = useState(null);
  const [specs, setSpecs] = useState([]);
  const [tools, setTools] = useState([]);

  const verifyCode = () => {
    if (code.trim().toUpperCase() === "CLIP24" || code.trim().length >= 6) {
      setStep(1);
      notify.success("Invite code accepted", "Welcome to the founding pilot");
    } else notify.urgent("Invalid invite code", "The pilot is invite-only. Try CLIP24 for the demo.");
  };

  const connect = async () => {
    setConnecting(true);
    const addr = await solanaAdapter.connectWallet();
    setWallet(addr);
    setConnecting(false);
    notify.success("Wallet connected", addr);
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploads.length >= 6) return notify.urgent("Maximum 6 portfolio uploads");
    setPct(0);
    const res = await storageAdapter.upload(file, setPct);
    setUploads((u) => [...u, res]);
    setPct(null);
  };

  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 mb-8">
          {[0, 1, 2, 3].map((s) => <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? "bg-[#CCFF00]" : "bg-white/10"}`} />)}
        </div>

        {step === 0 && (
          <div className="card-dark p-8 text-center">
            <KeyRound className="w-8 h-8 text-[#CCFF00] mx-auto mb-4" />
            <h1 className="text-2xl font-extrabold tracking-tighter mb-2">The pilot is invite-only.</h1>
            <p className="text-sm text-zinc-500 mb-6">Enter your invite code to join the founding clipper roster. (Demo code: CLIP24)</p>
            <input data-testid="invite-code-input" className="input-dark text-center font-mono text-lg tracking-[0.3em] uppercase mb-4" placeholder="INVITE CODE" value={code} onChange={(e) => setCode(e.target.value)} />
            <button data-testid="invite-code-submit" className="btn-lime h-12 w-full" onClick={verifyCode}>Verify Code</button>
          </div>
        )}

        {step === 1 && (
          <div className="card-dark p-8">
            <h1 className="text-2xl font-extrabold tracking-tighter mb-6">Create your profile</h1>
            <label className="label-caps block mb-2">Display name</label>
            <input data-testid="clipper-name-input" className="input-dark mb-6" placeholder="Your clipper name" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="label-caps block mb-2">Payout wallet (mock)</label>
            {wallet ? (
              <div className="flex items-center gap-2 bg-black/40 rounded-xl p-4 mb-6 text-sm font-mono"><Check className="w-4 h-4 text-[#CCFF00]" />{wallet}</div>
            ) : (
              <button data-testid="connect-wallet-btn" className="btn-ghost h-12 w-full mb-6" onClick={connect} disabled={connecting}>
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} {connecting ? "Connecting…" : "Connect Wallet"}
              </button>
            )}
            <button data-testid="profile-next-btn" className="btn-lime h-12 w-full" onClick={() => (name && wallet ? setStep(2) : notify.urgent("Add a name and connect your wallet"))}>Continue <ArrowRight className="w-4 h-4" /></button>
          </div>
        )}

        {step === 2 && (
          <div className="card-dark p-8">
            <h1 className="text-2xl font-extrabold tracking-tighter mb-2">Portfolio</h1>
            <p className="text-sm text-zinc-500 mb-6">Upload 3–6 of your best clips. This is what customers see first.</p>
            <label className="card-dark border-dashed p-8 text-center cursor-pointer hover:border-[#CCFF00]/40 transition-colors block mb-4" data-testid="portfolio-upload-label">
              <input type="file" className="hidden" onChange={upload} data-testid="portfolio-upload-input" />
              <Upload className="w-6 h-6 mx-auto mb-2 text-[#CCFF00]" />
              <span className="text-sm font-bold">Upload clip ({uploads.length}/6)</span>
              {pct !== null && <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-[#CCFF00] transition-[width]" style={{ width: `${pct}%` }} /></div>}
            </label>
            {uploads.map((u, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-2 border-b border-white/5"><Check className="w-4 h-4 text-[#CCFF00]" />{u.name}</div>
            ))}
            <button data-testid="portfolio-next-btn" className="btn-lime h-12 w-full mt-6" onClick={() => (uploads.length >= 3 ? setStep(3) : notify.urgent("Upload at least 3 clips"))}>Continue <ArrowRight className="w-4 h-4" /></button>
          </div>
        )}

        {step === 3 && (
          <div className="card-dark p-8">
            <h1 className="text-2xl font-extrabold tracking-tighter mb-6">Specialties & tools</h1>
            <label className="label-caps block mb-2">Specialties</label>
            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORIES.map((c) => (
                <button key={c} data-testid={`spec-${c.toLowerCase().replace(/\s/g, "-")}`} onClick={() => toggle(specs, setSpecs, c)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${specs.includes(c) ? "bg-[#CCFF00] text-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}>{c}</button>
              ))}
            </div>
            <label className="label-caps block mb-2">Editing tools</label>
            <div className="flex flex-wrap gap-2 mb-8">
              {TOOLS.map((t) => (
                <button key={t} onClick={() => toggle(tools, setTools, t)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${tools.includes(t) ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}>{t}</button>
              ))}
            </div>
            <button data-testid="submit-application-btn" className="btn-lime h-12 w-full" onClick={() => setStep(4)}>Submit Application</button>
          </div>
        )}

        {step === 4 && (
          <div className="card-dark p-8 text-center" data-testid="approval-pending-state">
            <Clock className="w-10 h-10 text-[#CCFF00] mx-auto mb-4" />
            <h1 className="text-2xl font-extrabold tracking-tighter mb-2">Application submitted</h1>
            <p className="text-sm text-zinc-500 mb-6">Every clipper is manually approved. You'll hear back within 24 hours — of course.</p>
            <div className="badge-live mx-auto w-fit mb-6">PENDING MANUAL APPROVAL</div>
            <button data-testid="demo-skip-approval-btn" className="btn-white h-12 w-full" onClick={() => { notify.success("Demo: approved instantly"); nav("/clipper"); }}>Demo: skip to Clipper Dashboard</button>
          </div>
        )}
      </div>
    </div>
  );
}
