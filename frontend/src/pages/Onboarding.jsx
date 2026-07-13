import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { ROLE_HOME } from "@/lib/roles";
import { CATEGORIES } from "@/data/demoVideos";
import { Sparkles, ArrowRight, Loader2, Film, Scissors, Users, RotateCcw, Zap, Check } from "lucide-react";

const TOOLS = ["Premiere Pro", "CapCut", "After Effects", "DaVinci Resolve", "Final Cut"];
const PLATFORMS = ["TikTok", "Reels", "YouTube Shorts", "X / Twitter", "LinkedIn"];

// The whole question set. Which ones appear depends on the role chosen first.
// A conversational flow (Vellum §7): one question per turn, streamed in.
const ROLE_Q = {
  id: "roles", kind: "choice",
  prompt: (n) => `Hey ${n} — first things first. Which side are you on?`,
  options: [
    { value: ["customer"], label: "I need clips", sub: "Creator / brand — post jobs, get clips back in 24h", icon: Film, display: "Creator" },
    { value: ["clipper"], label: "I make clips", sub: "Editor — bid on jobs, deliver against the clock", icon: Scissors, display: "Clipper" },
    { value: ["customer", "clipper"], label: "Both", sub: "Create and edit — one account, both dashboards", icon: Users, display: "Both" },
  ],
};
const CREATOR_QS = [
  { id: "brandName", kind: "text", prompt: () => "Love it. What's your brand or channel called?", placeholder: "e.g. NovaStreams" },
  { id: "niche", kind: "text", prompt: () => "What's your niche? A single line is plenty.", placeholder: "e.g. Variety gaming & IRL, 120k followers" },
  { id: "contentType", kind: "text", prompt: () => "What kind of footage will you send in?", placeholder: "e.g. Twitch VODs, podcast episodes" },
  { id: "platforms", kind: "multi", prompt: () => "Where do the clips go? Pick all that apply.", options: PLATFORMS },
  { id: "audience", kind: "text", optional: true, prompt: () => "Who's your audience? You can skip this.", placeholder: "e.g. 16–30 gamers" },
];
const CLIPPER_QS = [
  { id: "specialties", kind: "multi", prompt: () => "What do you specialize in?", options: CATEGORIES },
  { id: "tools", kind: "multi", prompt: () => "Which tools do you edit in?", options: TOOLS },
  { id: "samples", kind: "textarea", optional: true, prompt: () => "Got sample clips? Drop 1–3 links — one per line. You can skip this.", placeholder: "https://…" },
  { id: "wallet", kind: "text", optional: true, prompt: () => "Where should payouts land? A USDC / Solana address — or skip and add it later.", placeholder: "Solana address" },
];
const START_Q = {
  id: "startRole", kind: "choice",
  prompt: () => "You're set up for both. Which dashboard should I open first?",
  options: [
    { value: "customer", label: "Start as Creator", sub: "Switch anytime from the account menu", icon: Film, display: "Creator dashboard" },
    { value: "clipper", label: "Start as Clipper", sub: "Switch anytime from the account menu", icon: Scissors, display: "Clipper dashboard" },
  ],
};

function buildQueue(roles) {
  const q = [ROLE_Q];
  if (roles.includes("customer")) q.push(...CREATOR_QS);
  if (roles.includes("clipper")) q.push(...CLIPPER_QS);
  if (roles.length > 1) q.push(START_Q);
  return q;
}

export default function Onboarding() {
  const { user, completeOnboarding } = useApp();
  const nav = useNavigate();
  const firstName = user?.name?.split(" ")[0] || "there";

  const [answers, setAnswers] = useState({ roles: [] });
  const [log, setLog] = useState([]);     // [{ prompt, display }]
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState("");
  const [picks, setPicks] = useState([]); // multi-select working set
  const [typed, setTyped] = useState("");
  const [streaming, setStreaming] = useState(true);
  const [busy, setBusy] = useState(false);
  const finished = useRef(false);
  const bottom = useRef(null);

  const queue = useMemo(() => buildQueue(answers.roles), [answers.roles]);
  const current = queue[step];

  // Stream the current question in, character by character (honours reduced motion).
  useEffect(() => {
    if (!current) return;
    setDraft(""); setPicks([]);
    const full = current.prompt(firstName);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setTyped(full); setStreaming(false); return; }
    setTyped(""); setStreaming(true);
    let idx = 0;
    const iv = setInterval(() => {
      idx += 1;
      setTyped(full.slice(0, idx));
      if (idx >= full.length) { clearInterval(iv); setStreaming(false); }
    }, 16);
    return () => clearInterval(iv);
  }, [step, current, firstName]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [typed, log.length, streaming]);

  // When every question is answered, finish.
  useEffect(() => {
    if (!finished.current && answers.roles.length > 0 && step >= queue.length) {
      finished.current = true;
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, queue.length, answers.roles.length]);

  const commit = (display, patch) => {
    setLog((l) => [...l, { prompt: current.prompt(firstName), display }]);
    setAnswers((a) => ({ ...a, ...patch }));
    setStep((s) => s + 1);
  };

  const finish = async () => {
    setBusy(true);
    try {
      const a = answers;
      const payload = {
        roles: a.roles,
        active_role: a.roles.length > 1 ? a.startRole : a.roles[0],
        brand_name: a.brandName || "", niche: a.niche || "", content_type: a.contentType || "",
        platforms: (a.platforms || []).join(", "), audience: a.audience || "",
        specialties: a.specialties || [], tools: a.tools || [],
        samples: (a.samples || "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
        payout_wallet: (a.wallet || "").trim(),
      };
      const u = await completeOnboarding(payload);
      toast.success("You're all set — welcome aboard!");
      nav(ROLE_HOME[u.role] || "/", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not finish setup");
      finished.current = false;
      setBusy(false);
    }
  };

  const restart = () => {
    finished.current = false;
    setAnswers({ roles: [] }); setLog([]); setStep(0); setDraft(""); setPicks([]);
  };

  const submitText = () => {
    const val = draft.trim();
    if (!val && !current.optional) return;
    commit(val || "Skipped", { [current.id]: val });
  };
  const submitMulti = () => {
    if (picks.length === 0 && !current.optional) return;
    commit(picks.length ? picks.join(", ") : "Skipped", { [current.id]: picks });
  };

  const total = Math.max(queue.length, 1);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      {/* header: progress + wordmark + restart */}
      <div className="sticky top-0 z-10 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <button onClick={restart} title="Start over" className="text-zinc-500 hover:text-white transition-colors"><RotateCcw className="w-4 h-4" /></button>
          <div className="flex-1 flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, idx) => (
              <div key={idx} className={`h-1 flex-1 rounded-full transition-colors ${idx < step ? "bg-[#CCFF00]" : idx === step ? "bg-[#CCFF00]/40" : "bg-white/10"}`} />
            ))}
          </div>
          <span className="flex items-center gap-1.5 font-display font-extrabold text-sm tracking-tighter">
            <span className="w-5 h-5 rounded-full bg-[#CCFF00] flex items-center justify-center"><Zap className="w-3 h-3 text-black" fill="black" /></span>
            24HR<span className="text-[#CCFF00]">CLIPPING</span>
          </span>
        </div>
      </div>

      {/* chat */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* answered history — quiet */}
          {log.map((t, idx) => (
            <div key={idx} className="space-y-3 opacity-55">
              <Bubble>{t.prompt}</Bubble>
              <div className="flex justify-end">
                <span className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#CCFF00] text-black px-4 py-2 text-sm font-semibold">{t.display}</span>
              </div>
            </div>
          ))}

          {/* current question */}
          {current && (
            <div className="space-y-4">
              <Bubble>
                {typed}
                {streaming && <span className="inline-block w-1.5 h-4 -mb-0.5 ml-0.5 bg-[#CCFF00] animate-pulse" />}
              </Bubble>

              {!streaming && (
                <div className="pl-11 space-y-3" data-testid={`onb-q-${current.id}`}>
                  {current.kind === "choice" && current.options.map((o) => (
                    <Choice key={o.label} icon={o.icon} title={o.label} sub={o.sub}
                      onClick={() => commit(o.display, { [current.id]: o.value })} />
                  ))}

                  {current.kind === "multi" && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {current.options.map((o) => {
                          const on = picks.includes(o);
                          return (
                            <button key={o} type="button" onClick={() => setPicks((p) => on ? p.filter((x) => x !== o) : [...p, o])}
                              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${on ? "bg-[#CCFF00] text-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}>
                              {o}
                            </button>
                          );
                        })}
                      </div>
                      <ContinueRow optional={current.optional} onSkip={() => commit("Skipped", { [current.id]: [] })} onNext={submitMulti} disabled={picks.length === 0 && !current.optional} />
                    </>
                  )}

                  {(current.kind === "text" || current.kind === "textarea") && (
                    <>
                      {current.kind === "textarea" ? (
                        <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={current.placeholder}
                          className="input-dark min-h-[80px] py-2" data-testid="onb-input" />
                      ) : (
                        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={current.placeholder}
                          onKeyDown={(e) => { if (e.key === "Enter") submitText(); }}
                          className="input-dark" data-testid="onb-input" />
                      )}
                      <ContinueRow optional={current.optional} onSkip={() => commit("Skipped", { [current.id]: "" })} onNext={submitText} disabled={!draft.trim() && !current.optional} />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* finishing */}
          {!current && (
            <div className="flex items-center gap-3 text-zinc-400 pl-11">
              <Loader2 className="w-4 h-4 animate-spin text-[#CCFF00]" /> Setting up your space…
            </div>
          )}

          <div ref={bottom} />
        </div>
      </div>
    </div>
  );
}

function Bubble({ children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-8 h-8 shrink-0 rounded-full bg-[#CCFF00] flex items-center justify-center"><Sparkles className="w-4 h-4 text-black" /></span>
      <div className="bg-[#141414] border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-zinc-100 leading-relaxed max-w-[85%]">
        {children}
      </div>
    </div>
  );
}

function Choice({ icon: Icon, title, sub, onClick }) {
  return (
    <button onClick={onClick} data-testid={`onb-choice-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}
      className="w-full text-left flex items-start gap-4 rounded-2xl border border-white/10 hover:border-[#CCFF00]/50 bg-white/[0.02] hover:bg-white/[0.04] p-4 transition-colors">
      <span className="w-10 h-10 shrink-0 rounded-xl bg-white/5 text-[#CCFF00] flex items-center justify-center"><Icon className="w-5 h-5" /></span>
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-zinc-500">{sub}</span>
      </span>
    </button>
  );
}

function ContinueRow({ optional, onSkip, onNext, disabled }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button data-testid="onb-continue" onClick={onNext} disabled={disabled} className="btn-lime h-11 px-6 justify-center disabled:opacity-40">
        Continue <ArrowRight className="w-4 h-4" />
      </button>
      {optional && <button onClick={onSkip} className="text-sm text-zinc-500 hover:text-white transition-colors">Skip</button>}
    </div>
  );
}
