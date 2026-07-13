import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { ROLE_HOME } from "@/lib/roles";
import { CATEGORIES } from "@/data/demoVideos";
import { Sparkles, ArrowRight, ArrowLeft, Loader2, Film, Scissors, Users } from "lucide-react";

const TOOLS = ["Premiere Pro", "CapCut", "After Effects", "DaVinci Resolve", "Final Cut"];
const PLATFORMS = ["TikTok", "Reels", "YouTube Shorts", "X / Twitter", "LinkedIn"];

const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

// A guided, conversational onboarding. Deterministic (no API key needed); it
// asks who you are, then collects just enough to tailor your dashboard.
export default function Onboarding() {
  const { user, completeOnboarding } = useApp();
  const nav = useNavigate();

  const [roles, setRoles] = useState([]); // subset of customer/clipper
  const [i, setI] = useState(0);          // index into the screen queue
  const [busy, setBusy] = useState(false);

  // Creator answers
  const [brandName, setBrandName] = useState("");
  const [niche, setNiche] = useState("");
  const [contentType, setContentType] = useState("");
  const [platforms, setPlatforms] = useState([]);
  const [audience, setAudience] = useState("");
  // Clipper answers
  const [specialties, setSpecialties] = useState([]);
  const [tools, setTools] = useState([]);
  const [samples, setSamples] = useState("");
  const [wallet, setWallet] = useState("");
  // Both: which dashboard to land in
  const [activeRole, setActiveRole] = useState(null);

  // Build the screen queue from the chosen roles.
  const screens = useMemo(() => {
    const s = ["who"];
    if (roles.includes("customer")) s.push("brand");
    if (roles.includes("clipper")) s.push("clip");
    if (roles.length > 1) s.push("start");
    return s;
  }, [roles]);

  const screen = screens[Math.min(i, screens.length - 1)];
  const pct = Math.round(((i + 1) / screens.length) * 100);
  const firstName = user?.name?.split(" ")[0] || "there";

  const choose = (picked) => {
    setRoles(picked);
    setActiveRole(picked[0]);
    setI(1);
  };

  const next = () => setI((n) => Math.min(n + 1, screens.length - 1));
  const back = () => setI((n) => Math.max(n - 1, 0));
  const isLast = i === screens.length - 1;

  const finish = async () => {
    setBusy(true);
    try {
      const payload = {
        roles,
        active_role: roles.length > 1 ? activeRole : roles[0],
        brand_name: brandName, niche, content_type: contentType,
        platforms: platforms.join(", "), audience,
        specialties, tools,
        samples: samples.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
        payout_wallet: wallet.trim(),
      };
      const u = await completeOnboarding(payload);
      toast.success("You're all set — welcome aboard!");
      nav(ROLE_HOME[u.role] || "/", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not finish setup");
      setBusy(false);
    }
  };

  const onNext = () => (isLast ? finish() : next());

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        {/* progress */}
        <div className="flex items-center gap-2 mb-8">
          {screens.map((s, idx) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${idx <= i ? "bg-[#CCFF00]" : "bg-white/10"}`} />
          ))}
        </div>

        {/* assistant bubble */}
        <div className="flex items-start gap-3 mb-5">
          <span className="w-9 h-9 shrink-0 rounded-full bg-[#CCFF00] flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-black" />
          </span>
          <div className="bg-[#141414] border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
            <Prompt screen={screen} name={firstName} roles={roles} />
          </div>
        </div>

        <div className="card-dark p-6 sm:p-8">
          {screen === "who" && (
            <div className="space-y-3">
              <Choice icon={Film} title="I need clips" sub="I'm a creator / brand — post jobs, get clips back in 24h."
                onClick={() => choose(["customer"])} testid="onb-role-creator" />
              <Choice icon={Scissors} title="I make clips" sub="I'm an editor — bid on jobs and deliver against the clock."
                onClick={() => choose(["clipper"])} testid="onb-role-clipper" />
              <Choice icon={Users} title="Both" sub="I create AND edit. Give me one account with both dashboards."
                onClick={() => choose(["customer", "clipper"])} testid="onb-role-both" />
            </div>
          )}

          {screen === "brand" && (
            <div className="space-y-4">
              <Field label="Brand / channel name">
                <input data-testid="onb-brand-name" className="input-dark" placeholder="e.g. NovaStreams" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
              </Field>
              <Field label="What's your niche?">
                <input data-testid="onb-niche" className="input-dark" placeholder="e.g. Variety gaming & IRL, 120k followers" value={niche} onChange={(e) => setNiche(e.target.value)} />
              </Field>
              <Field label="What content do you post?">
                <input className="input-dark" placeholder="e.g. Twitch VODs, podcast episodes" value={contentType} onChange={(e) => setContentType(e.target.value)} />
              </Field>
              <Field label="Where do the clips go?">
                <Chips options={PLATFORMS} selected={platforms} onToggle={(v) => setPlatforms((a) => toggle(a, v))} />
              </Field>
              <Field label="Who's your audience? (optional)">
                <input className="input-dark" placeholder="e.g. 16–30 gamers" value={audience} onChange={(e) => setAudience(e.target.value)} />
              </Field>
            </div>
          )}

          {screen === "clip" && (
            <div className="space-y-4">
              <Field label="What do you specialize in?">
                <Chips options={CATEGORIES} selected={specialties} onToggle={(v) => setSpecialties((a) => toggle(a, v))} />
              </Field>
              <Field label="Which tools do you edit in?">
                <Chips options={TOOLS} selected={tools} onToggle={(v) => setTools((a) => toggle(a, v))} light />
              </Field>
              <Field label="Sample links (optional)">
                <textarea data-testid="onb-samples" className="input-dark min-h-[72px] py-2" placeholder="Paste 1–3 links to your best clips, one per line" value={samples} onChange={(e) => setSamples(e.target.value)} />
              </Field>
              <Field label="Payout wallet (optional — add later)">
                <input className="input-dark font-mono text-sm" placeholder="USDC / Solana address" value={wallet} onChange={(e) => setWallet(e.target.value)} />
              </Field>
            </div>
          )}

          {screen === "start" && (
            <div className="space-y-3">
              <Choice icon={Film} title="Start as a Creator" sub="Land on your creator dashboard. Switch anytime from the menu."
                active={activeRole === "customer"} onClick={() => setActiveRole("customer")} testid="onb-start-creator" />
              <Choice icon={Scissors} title="Start as a Clipper" sub="Land on your clipper dashboard. Switch anytime from the menu."
                active={activeRole === "clipper"} onClick={() => setActiveRole("clipper")} testid="onb-start-clipper" />
            </div>
          )}

          {/* nav buttons (hidden on the initial role picker) */}
          {screen !== "who" && (
            <div className="flex items-center gap-3 mt-8">
              {i > 1 && (
                <button onClick={back} className="btn-ghost h-12 px-5"><ArrowLeft className="w-4 h-4" /> Back</button>
              )}
              <button data-testid="onb-next" disabled={busy} onClick={onNext} className="btn-lime h-12 flex-1 justify-center">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>{isLast ? "Enter my dashboard" : "Continue"} <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-zinc-600 mt-5">You can refine all of this later in your profile.</p>
      </div>
    </div>
  );
}

function Prompt({ screen, name, roles }) {
  const text = {
    who: `GM ${name} 👋 Quick setup — which side are you on?`,
    brand: "Nice. Tell me about your brand so clippers nail your vibe from the first cut.",
    clip: "Let's build your clipper profile so the right jobs find you.",
    start: "You're set up for both. Which dashboard should I open first?",
  }[screen];
  return <p className="text-sm text-zinc-200 leading-relaxed">{text}</p>;
}

function Choice({ icon: Icon, title, sub, onClick, active, testid }) {
  return (
    <button data-testid={testid} onClick={onClick}
      className={`w-full text-left flex items-start gap-4 rounded-2xl border p-4 transition-colors ${active ? "border-[#CCFF00] bg-[#CCFF00]/10" : "border-white/10 hover:border-white/30 bg-white/[0.02]"}`}>
      <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${active ? "bg-[#CCFF00] text-black" : "bg-white/5 text-[#CCFF00]"}`}>
        <Icon className="w-5 h-5" />
      </span>
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-zinc-500">{sub}</span>
      </span>
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label-caps block mb-2">{label}</label>
      {children}
    </div>
  );
}

function Chips({ options, selected, onToggle, light }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button key={o} type="button" onClick={() => onToggle(o)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${on ? (light ? "bg-white text-black" : "bg-[#CCFF00] text-black") : "bg-white/5 text-zinc-400 hover:text-white"}`}>
            {o}
          </button>
        );
      })}
    </div>
  );
}
