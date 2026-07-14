import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dbAdapter, bondFor } from "@/services/dbAdapter";
import { storageAdapter } from "@/services/storageAdapter";
import { notify } from "@/services/notificationAdapter";
import { CATEGORIES } from "@/data/demoVideos";
import FileDropzone from "@/components/FileDropzone";
import { Sparkles, Link2, ArrowRight, ArrowLeft, Zap, Image as ImageIcon } from "lucide-react";

const chip = (active) => `px-4 py-2 rounded-full text-sm font-bold transition-colors ${active ? "bg-[#CCFF00] text-black" : "bg-white/5 text-zinc-400 hover:text-white"}`;

export default function CreateProject() {
  const nav = useNavigate();
  // Default straight into the manual builder (step 1). The AI concierge is now a
  // small inline link rather than a full-screen decision gate.
  const [step, setStep] = useState(1);
  const [uploadPct, setUploadPct] = useState(null);
  const [uploaded, setUploaded] = useState(null);
  const [thumbPct, setThumbPct] = useState(null);
  const [thumb, setThumb] = useState(null); // { key, name, preview }
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title: "", category: "Stream Highlights", source_link: "", moment_mode: "known",
    goal: "Grow my audience", audience: "", mood: "Hype", style: "Fast cuts, punch-ins",
    platform: "TikTok", output_length: "30-60s", aspect_ratio: "9:16",
    captions: "Bold captions", cta: "Follow for more", budget: 100, description: "",
    references: "", quality_notes: "", allow_extension: false,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const uploadFile = async (file) => {
    if (!file) return;
    setUploadPct(0);
    const res = await storageAdapter.upload(file, setUploadPct, { kind: "source" });
    setUploaded(res);
    setUploadPct(null);
    notify.success("Footage uploaded", file.name);
  };

  const uploadThumb = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify.urgent("Thumbnail must be an image (JPG or PNG)");
    setThumbPct(0);
    try {
      const res = await storageAdapter.upload(file, setThumbPct, { kind: "source" });
      setThumb({ ...res, preview: URL.createObjectURL(file) });
      notify.success("Thumbnail set", file.name);
    } catch {
      notify.urgent("Thumbnail upload failed");
    }
    setThumbPct(null);
  };

  const submit = async () => {
    if (!f.title) return notify.urgent("Give your project a title");
    setSaving(true);
    try {
      const references = f.references.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      const p = await dbAdapter.createProject({ ...f, budget: Number(f.budget), references, source_key: uploaded?.key, thumbnail_key: thumb?.key, source_link: f.source_link || uploaded?.name || "Uploaded footage" });
      nav(`/customer/checkout/${p.id}`);
    } catch {
      notify.urgent("Could not create project");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? "bg-[#CCFF00]" : "bg-white/10"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tighter">The footage</h1>
              <Link to="/customer/concierge" data-testid="create-ai-path" className="text-sm font-semibold text-[#CCFF00] hover:underline flex items-center gap-1 shrink-0">
                or talk it out with AI <Sparkles className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div>
              <label className="label-caps block mb-2">Project title</label>
              <input data-testid="project-title-input" className="input-dark" placeholder="e.g. Ranked Finals Clutch Moment" value={f.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <label className="label-caps block mb-2">Category</label>
              <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <button key={c} data-testid={`cat-${c.toLowerCase().replace(/\s/g, "-")}`} className={chip(f.category === c)} onClick={() => set("category", c)}>{c}</button>)}</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <FileDropzone
                compact
                onFile={uploadFile}
                uploading={uploadPct}
                doneName={uploaded?.name}
                title="Upload footage"
                hint="Drag & drop or click · MP4, MOV"
                wrapperTestId="upload-footage-label"
                inputTestId="upload-footage-input"
              />
              <div className="card-dark p-6">
                <div className="flex items-center gap-2 mb-2 text-sm font-bold"><Link2 className="w-4 h-4 text-[#CCFF00]" /> Or paste a link</div>
                <input data-testid="source-link-input" className="input-dark h-10 text-sm" placeholder="Twitch, YouTube, Drive, Dropbox…" value={f.source_link} onChange={(e) => set("source_link", e.target.value)} />
                <p className="text-xs text-zinc-600 mt-2">No file yet? A link works - the clipper pulls the footage.</p>
              </div>
            </div>
            <div>
              <label className="label-caps block mb-2">Thumbnail <span className="normal-case tracking-normal text-zinc-600">- optional cover shown in the marketplace &amp; bid room</span></label>
              <label data-testid="upload-thumbnail-label" className="card-dark p-4 flex items-center gap-4 cursor-pointer hover:border-[#CCFF00]/40 transition-colors">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/40 flex items-center justify-center shrink-0">
                  {thumb?.preview ? <img src={thumb.preview} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-zinc-600" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{thumb ? "Thumbnail set - click to change" : "Upload a thumbnail image"}</p>
                  <p className="text-xs text-zinc-500">{thumbPct !== null ? `Uploading… ${thumbPct}%` : "JPG or PNG · gives your job a custom cover"}</p>
                </div>
                <input data-testid="upload-thumbnail-input" type="file" accept="image/*" className="hidden" onChange={(e) => uploadThumb(e.target.files?.[0])} />
              </label>
            </div>
            <div>
              <label className="label-caps block mb-2">The moment</label>
              <div className="grid sm:grid-cols-2 gap-3">
                <button data-testid="moment-known" onClick={() => set("moment_mode", "known")} className={`card-dark p-4 text-left text-sm font-bold ${f.moment_mode === "known" ? "border-[#CCFF00]" : ""}`}>I Know the Moment<span className="block text-xs text-zinc-500 font-normal mt-1">I'll give timestamps</span></button>
                <button data-testid="moment-find" onClick={() => set("moment_mode", "find")} className={`card-dark p-4 text-left text-sm font-bold ${f.moment_mode === "find" ? "border-[#CCFF00]" : ""}`}>Find the Best Moment for Me<span className="block text-xs text-zinc-500 font-normal mt-1">Clipper scouts the footage</span></button>
              </div>
            </div>
            <button data-testid="step1-next" className="btn-lime h-12 w-full disabled:opacity-40 disabled:cursor-not-allowed" disabled={!f.title.trim()} onClick={() => setStep(2)}>{f.title.trim() ? "Continue" : "Add a title to continue"} <ArrowRight className="w-4 h-4" /></button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tighter">The vibe</h1>
                <p className="text-sm text-zinc-500 mt-1">All optional - smart defaults are already set. Tweak anything, or skip.</p>
              </div>
              <button data-testid="step2-skip" className="btn-ghost h-10 px-5 text-sm shrink-0" onClick={() => setStep(3)}>Skip - use defaults <ArrowRight className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="label-caps block mb-2">Goal</label>
              <div className="flex flex-wrap gap-2">{["Grow my audience", "Drive sales", "Build authority", "Go viral"].map((g) => <button key={g} className={chip(f.goal === g)} onClick={() => set("goal", g)}>{g}</button>)}</div>
            </div>
            <div>
              <label className="label-caps block mb-2">Target audience</label>
              <input data-testid="audience-input" className="input-dark" placeholder="e.g. 18-34 gamers who love ranked play" value={f.audience} onChange={(e) => set("audience", e.target.value)} />
            </div>
            <div>
              <label className="label-caps block mb-2">Mood</label>
              <div className="flex flex-wrap gap-2">{["Hype", "Insightful", "Premium", "Authentic", "Comedic"].map((m) => <button key={m} className={chip(f.mood === m)} onClick={() => set("mood", m)}>{m}</button>)}</div>
            </div>
            <div>
              <label className="label-caps block mb-2">Platform</label>
              <div className="flex flex-wrap gap-2">{["TikTok", "Instagram Reels", "YouTube Shorts", "X / Twitter"].map((p) => <button key={p} className={chip(f.platform === p)} onClick={() => set("platform", p)}>{p}</button>)}</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label-caps block mb-2">Output length</label>
                <div className="flex flex-wrap gap-2">{["15-30s", "30-60s", "60-90s"].map((o) => <button key={o} className={chip(f.output_length === o)} onClick={() => set("output_length", o)}>{o}</button>)}</div>
              </div>
              <div>
                <label className="label-caps block mb-2">Aspect ratio</label>
                <div className="flex flex-wrap gap-2">{["9:16", "1:1", "4:5", "16:9"].map((a) => <button key={a} data-testid={`ar-${a.replace(":", "-")}`} className={chip(f.aspect_ratio === a)} onClick={() => set("aspect_ratio", a)}>{a}</button>)}</div>
              </div>
            </div>
            <div>
              <label className="label-caps block mb-2">Captions</label>
              <div className="flex flex-wrap gap-2">{["Bold captions", "Clean subtitles", "Karaoke style", "No captions"].map((c) => <button key={c} className={chip(f.captions === c)} onClick={() => set("captions", c)}>{c}</button>)}</div>
            </div>
            <div>
              <label className="label-caps block mb-2">Reference clips you love <span className="normal-case tracking-normal text-zinc-600">- paste links, one per line</span></label>
              <textarea data-testid="references-input" className="input-dark h-24 py-3 text-sm" placeholder={"https://tiktok.com/@creator/video/...\nhttps://youtube.com/shorts/..."} value={f.references} onChange={(e) => set("references", e.target.value)} />
              <p className="text-xs text-zinc-600 mt-1.5">Show the clipper the style, pacing, and edits you want to match.</p>
            </div>
            <div>
              <label className="label-caps block mb-2">Your quality bar & taste</label>
              <textarea data-testid="quality-notes-input" className="input-dark h-24 py-3 text-sm" placeholder="e.g. Punchy first frame, zero dead air, clean sound design, no cheap zoom transitions. Premium feel over quantity." value={f.quality_notes} onChange={(e) => set("quality_notes", e.target.value)} />
              <p className="text-xs text-zinc-600 mt-1.5">Describe what a great cut looks like to you, and what to avoid.</p>
            </div>
            <div className="flex gap-3">
              <button className="btn-ghost h-12 px-6" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4" /> Back</button>
              <button data-testid="step2-next" className="btn-lime h-12 flex-1" onClick={() => setStep(3)}>Continue <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tighter">Budget & final touches</h1>
            <div className="card-dark p-5" data-testid="brief-summary">
              <div className="flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-[#CCFF00]" /><span className="label-caps">Your brief</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[["Title", f.title || "Untitled"], ["Category", f.category], ["Platform", f.platform], ["Output", f.output_length], ["Ratio", f.aspect_ratio], ["Mood", f.mood], ["Captions", f.captions], ["Footage", uploaded ? "Uploaded" : (f.source_link ? "Linked" : "Add on funding")]].map(([l, v]) => (
                  <div key={l} className="bg-black/40 rounded-lg p-2.5"><span className="text-zinc-500 block truncate">{l}</span><span className="font-bold truncate block">{v}</span></div>
                ))}
              </div>
            </div>
            <div className="card-dark p-6">
              <label className="label-caps block mb-4">Budget - <span className="font-mono text-[#CCFF00] text-base">${f.budget}</span></label>
              <input data-testid="budget-slider" type="range" min="20" max="500" step="5" value={f.budget} onChange={(e) => set("budget", e.target.value)} className="w-full accent-[#CCFF00]" />
              <div className="flex justify-between text-xs text-zinc-600 mt-2 font-mono"><span>$20</span><span>$500</span></div>
              <div className="mt-4 text-xs text-zinc-400 bg-black/40 rounded-xl p-3">Clipper's Deadline Bond at this budget: <span className="font-mono font-bold text-[#CCFF00]">${bondFor(Number(f.budget))}</span> - locked behind your deadline.</div>
            </div>
            <div className="card-dark p-5">
              <button type="button" data-testid="allow-extension-toggle" onClick={() => set("allow_extension", !f.allow_extension)} className="w-full flex items-center gap-4 text-left">
                <span className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${f.allow_extension ? "bg-[#CCFF00]" : "bg-white/15"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black transition-transform ${f.allow_extension ? "translate-x-5" : ""}`} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">Allow the clipper to extend the deadline</span>
                  <span className="block text-xs text-zinc-500 mt-0.5">Off = a hard 24-hour clock. On = the clipper can add time if they need it (up to +48h), so it's not locked to 24 hours.</span>
                </span>
              </button>
            </div>
            <div>
              <label className="label-caps block mb-2">Call to action</label>
              <input data-testid="cta-input" className="input-dark" value={f.cta} onChange={(e) => set("cta", e.target.value)} />
            </div>
            <div>
              <label className="label-caps block mb-2">Anything else? (references, brand notes)</label>
              <textarea data-testid="description-input" className="input-dark h-24 py-3" placeholder="Reference clips, brand assets, styles to avoid…" value={f.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button className="btn-ghost h-12 px-6" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4" /> Back</button>
              <button data-testid="create-project-submit" className="btn-lime h-12 flex-1" disabled={saving} onClick={submit}>{saving ? "Creating…" : "Review brief & fund"} <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
