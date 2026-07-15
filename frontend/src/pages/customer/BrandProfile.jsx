import { useEffect, useState } from "react";
import { dbAdapter } from "@/services/dbAdapter";
import { notify } from "@/services/notificationAdapter";
import { Sparkles, Save, Plus, X, Palette } from "lucide-react";

const GROUPS = [
  {
    title: "Identity",
    fields: [
      ["name", "Business or creator name", "input", "e.g. NovaStreams"],
      ["description", "What you're about", "textarea", "Variety streamer, 120k followers. High-energy gaming and IRL."],
      ["audience", "Your audience", "input", "16-30 gamers"],
    ],
  },
  {
    title: "Voice & style",
    fields: [
      ["caption_style", "Caption style", "input", "Bold, all-caps hooks"],
      ["pacing", "Preferred pacing", "input", "Fast, 1.5s max shot length"],
      ["fonts", "Fonts", "input", "Manrope, bold"],
      ["cta", "Go-to call to action", "input", "Follow @NovaStreams"],
    ],
  },
  {
    title: "Guardrails",
    fields: [
      ["avoid", "Styles & words to avoid", "textarea", "Slow intros, watermark clutter, cringe zooms"],
    ],
  },
];

export default function BrandProfile() {
  const [b, setB] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dbAdapter.getBrandProfiles().then((list) => setB(list[0] || {})).catch(() => setB({}));
  }, []);

  const set = (k, v) => setB((p) => ({ ...p, [k]: v }));
  const colors = b?.colors?.length ? b.colors : ["#CCFF00", "#0A0A0A"];
  const setColor = (i, v) => set("colors", colors.map((c, idx) => (idx === i ? v : c)));
  const addColor = () => set("colors", [...colors, "#7C7CFF"]);
  const removeColor = (i) => set("colors", colors.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    const { id, logo, reference_clips, owner, ...rest } = b || {};
    try {
      await dbAdapter.updateBrandProfile(b.id || "new", { ...rest, colors });
      notify.success("Brand profile saved", "Future briefs will auto-fill with this.");
    } catch {
      notify.urgent("Could not save brand profile");
    }
    setSaving(false);
  };

  if (!b) return <div className="min-h-screen bg-[#0A0A0A]" />;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 flex-1">
        <span className="label-caps">Brand memory</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter mt-2 mb-2">Brand Profile</h1>
        <p className="text-zinc-500 mb-8 max-w-xl">Save it once. Every future brief auto-fills with your voice, pacing, and style - so posting a clip takes seconds, not minutes.</p>

        {/* Live preview */}
        <div className="relative card-dark p-6 mb-8 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: `linear-gradient(120deg, ${colors[0] || "#CCFF00"}22, transparent 60%)` }} />
          <div className="relative flex items-center gap-4 flex-wrap">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center font-display font-extrabold text-lg shrink-0" style={{ background: colors[0] || "#CCFF00", color: "#0A0A0A" }}>
              {(b.name || "Y").trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="font-display font-bold text-lg truncate">{b.name || "Your brand"}</div>
              <div className="text-xs text-zinc-500 truncate">{b.caption_style || "Caption style"} · {b.pacing || "Pacing"}</div>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              {colors.map((c, i) => <span key={i} className="w-5 h-5 rounded-full border border-white/15" style={{ background: c }} />)}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {GROUPS.map((g) => (
            <div key={g.title} className="card-dark p-6 sm:p-7">
              <div className="label-caps mb-5">{g.title}</div>
              <div className="space-y-4">
                {g.fields.map(([k, label, type, ph]) => (
                  <div key={k}>
                    <label className="text-sm font-semibold text-zinc-300 block mb-1.5">{label}</label>
                    {type === "textarea" ? (
                      <textarea data-testid={`brand-${k}`} className="input-dark h-20 py-3 text-sm" placeholder={ph} value={b[k] || ""} onChange={(e) => set(k, e.target.value)} />
                    ) : (
                      <input data-testid={`brand-${k}`} className="input-dark text-sm" placeholder={ph} value={b[k] || ""} onChange={(e) => set(k, e.target.value)} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Interactive colors */}
          <div className="card-dark p-6 sm:p-7">
            <div className="label-caps mb-1 flex items-center gap-2"><Palette className="w-3.5 h-3.5 text-[#CCFF00]" /> Brand colors</div>
            <p className="text-xs text-zinc-500 mb-5">Click a swatch to change it. These guide the clipper's captions and graphics.</p>
            <div className="flex items-end gap-4 flex-wrap">
              {colors.map((c, i) => (
                <div key={i} className="group relative flex flex-col items-center">
                  <label className="relative block w-14 h-14 rounded-2xl border border-white/15 cursor-pointer overflow-hidden hover:border-white/35 transition-colors" style={{ background: c }}>
                    <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : "#CCFF00"} onChange={(e) => setColor(i, e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                  </label>
                  {colors.length > 1 && (
                    <button onClick={() => removeColor(i)} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#1A1A1A] border border-white/20 text-zinc-400 hover:text-[#FF4500] hover:border-[#FF4500]/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <span className="text-[10px] text-zinc-600 mt-1.5 font-mono">{c}</span>
                </div>
              ))}
              {colors.length < 8 && (
                <button onClick={addColor} className="w-14 h-14 rounded-2xl border border-dashed border-white/20 text-zinc-500 hover:text-white hover:border-[#CCFF00]/40 flex items-center justify-center transition-colors mb-5">
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <button data-testid="brand-save-btn" className="btn-lime h-12 w-full" disabled={saving} onClick={save}>
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Brand Profile"}
          </button>
        </div>

        <div className="card-dark p-6 mt-6 border-[#CCFF00]/30 flex gap-4 items-start">
          <Sparkles className="w-5 h-5 text-[#CCFF00] shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-400"><span className="text-white font-bold">Auto-fill in action:</span> post your next project and the builder pre-loads your caption style, pacing, CTA and avoid-list - briefs take seconds, not minutes.</p>
        </div>
      </div>
    </div>
  );
}
