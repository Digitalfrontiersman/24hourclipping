import { useEffect, useState } from "react";
import { dbAdapter } from "@/services/dbAdapter";
import { notify } from "@/services/notificationAdapter";
import Footer from "@/components/Footer";
import { Sparkles, Save } from "lucide-react";

const FIELDS = [
  ["name", "Business or creator name", "input"],
  ["description", "Description", "textarea"],
  ["audience", "Audience", "input"],
  ["caption_style", "Caption style", "input"],
  ["pacing", "Preferred pacing", "input"],
  ["fonts", "Fonts", "input"],
  ["cta", "Calls to action", "input"],
  ["avoid", "Styles & words to avoid", "textarea"],
];

export default function BrandProfile() {
  const [b, setB] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dbAdapter.getBrandProfiles().then((list) => setB(list[0] || { id: "brand-1" })).catch(() => setB({ id: "brand-1" }));
  }, []);

  const save = async () => {
    setSaving(true);
    const { id, logo, colors, reference_clips, owner, ...payload } = b;
    await dbAdapter.updateBrandProfile(b.id || "brand-1", payload);
    setSaving(false);
    notify.success("Brand profile saved", "Future briefs will auto-fill with this");
  };

  if (!b) return <div className="min-h-screen bg-[#0A0A0A]" />;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <span className="label-caps">Brand memory</span>
        <h1 className="text-3xl font-extrabold tracking-tighter mt-2 mb-2">Brand Profile</h1>
        <p className="text-zinc-500 mb-8">Save this once. Every future brief auto-fills with your brand voice, pacing and style.</p>

        <div className="card-dark p-6 sm:p-8 space-y-5">
          {FIELDS.map(([k, label, type]) => (
            <div key={k}>
              <label className="label-caps block mb-2">{label}</label>
              {type === "textarea" ? (
                <textarea data-testid={`brand-${k}`} className="input-dark h-20 py-3 text-sm" value={b[k] || ""} onChange={(e) => setB({ ...b, [k]: e.target.value })} />
              ) : (
                <input data-testid={`brand-${k}`} className="input-dark text-sm" value={b[k] || ""} onChange={(e) => setB({ ...b, [k]: e.target.value })} />
              )}
            </div>
          ))}
          <div>
            <label className="label-caps block mb-2">Brand colors</label>
            <div className="flex gap-2">
              {(b.colors || ["#CCFF00", "#0A0A0A"]).map((c, i) => (
                <span key={i} className="w-10 h-10 rounded-full border border-white/20" style={{ background: c }} title={c} />
              ))}
            </div>
          </div>
          <button data-testid="brand-save-btn" className="btn-lime h-12 w-full" disabled={saving} onClick={save}><Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Brand Profile"}</button>
        </div>

        <div className="card-dark p-6 mt-6 border-[#CCFF00]/30 flex gap-4 items-start">
          <Sparkles className="w-5 h-5 text-[#CCFF00] shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-400"><span className="text-white font-bold">Auto-fill in action:</span> when you post your next project, the concierge and manual builder pre-load your caption style, pacing, CTA and avoid-list — so briefs take seconds, not minutes.</p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
