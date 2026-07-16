import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { dbAdapter } from "@/services/dbAdapter";
import { storageAdapter } from "@/services/storageAdapter";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { Star, BadgeCheck, Timer, Play, ArrowLeft, Pencil, Camera, X, Loader2, Check, Plus, Trash2, Link2 } from "lucide-react";

const TOOL_OPTIONS = ["Premiere Pro", "CapCut", "After Effects", "DaVinci Resolve", "Final Cut", "Photoshop", "Motion"];

// Label + accent color per platform so portfolio cards read at a glance.
const platformOf = (url = "") => {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return { name: "YouTube", cls: "text-red-400" };
  if (u.includes("tiktok.com")) return { name: "TikTok", cls: "text-pink-300" };
  if (u.includes("instagram.com")) return { name: "Instagram", cls: "text-fuchsia-300" };
  if (u.includes("twitch.tv")) return { name: "Twitch", cls: "text-purple-300" };
  if (u.includes("x.com") || u.includes("twitter.com")) return { name: "X", cls: "text-zinc-300" };
  if (u.includes("vimeo.com")) return { name: "Vimeo", cls: "text-sky-300" };
  if (u.includes("drive.google")) return { name: "Drive", cls: "text-emerald-300" };
  return { name: "Link", cls: "text-zinc-400" };
};

export default function ClipperProfile() {
  const { id } = useParams();
  const { user } = useApp();
  const [c, setC] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => { dbAdapter.getClipper(id).then(setC).catch(() => {}); }, [id]);

  if (!c) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><div className="card-dark w-full max-w-3xl h-96 mx-4 animate-pulse" /></div>;

  const isOwner = user?.id === c.id;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/clippers" className="text-sm text-zinc-500 hover:text-white flex items-center gap-2 mb-8 transition-colors" data-testid="back-to-directory"><ArrowLeft className="w-4 h-4" /> Directory</Link>

        <div className="flex flex-col sm:flex-row items-start gap-6 mb-10">
          <img src={c.avatar} alt="" className="w-24 h-24 rounded-full object-cover border border-white/10" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter">{c.name}</h1>
              <BadgeCheck className="w-6 h-6 text-zinc-400" />
              <span className={`badge-live ${c.badge === "Founding Clipper" ? "text-white border-white/25" : ""}`}>{c.badge}</span>
            </div>
            <p className="text-zinc-400 mt-1">{c.specialty} · {c.price_range}</p>
            {c.bio && <p className="text-sm text-zinc-400 mt-3 max-w-xl leading-relaxed">{c.bio}</p>}
            {Array.isArray(c.tools) && c.tools.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {c.tools.map((t) => <span key={t} className="text-[11px] text-zinc-400 border border-white/10 rounded-full px-2.5 py-0.5">{t}</span>)}
              </div>
            )}
          </div>
          {isOwner && (
            <button data-testid="edit-profile-btn" onClick={() => setEditing(true)} className="btn-ghost h-10 px-5 text-sm shrink-0">
              <Pencil className="w-4 h-4" /> Edit profile
            </button>
          )}
        </div>

        {/* On-time hero stat */}
        <div className="grid sm:grid-cols-4 gap-4 mb-10">
          <div className="card-dark p-6 sm:col-span-2">
            <div className="label-caps mb-2">On-time delivery - the score that matters</div>
            <div className="font-mono text-5xl font-extrabold flex items-center gap-3"><Timer className="w-8 h-8 text-zinc-500" />{c.on_time_pct}%</div>
            <div className="text-xs text-zinc-500 mt-2">{c.missed_deadlines} missed deadlines · {c.completed_jobs} completed jobs</div>
          </div>
          <div className="card-dark p-6">
            <div className="label-caps mb-2">Overall</div>
            <div className="font-mono text-4xl font-extrabold flex items-center gap-2"><Star className="w-6 h-6 text-zinc-300" fill="currentColor" />{c.rating}</div>
          </div>
          <div className="card-dark p-6">
            <div className="label-caps mb-2">Repeat clients</div>
            <div className="font-mono text-4xl font-extrabold">{c.repeat_clients}</div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {[["Editing quality", c.ratings.editing], ["Brief match", c.ratings.brief_match], ["Communication", c.ratings.communication]].map(([l, v]) => (
            <div key={l} className="card-dark p-5 flex items-center justify-between">
              <span className="text-sm text-zinc-400">{l}</span>
              <span className="font-mono font-bold text-lg">{v}<span className="text-zinc-600 text-sm">/5</span></span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl">Portfolio</h2>
          {isOwner && c.portfolio.length > 0 && (
            <button onClick={() => setEditing(true)} className="text-sm text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors" data-testid="edit-portfolio-btn">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>
        {c.portfolio.length === 0 ? (
          isOwner ? (
            <button onClick={() => setEditing(true)} data-testid="add-portfolio-empty"
              className="w-full rounded-2xl border border-dashed border-white/15 hover:border-[#CCFF00]/50 hover:bg-[#CCFF00]/[0.03] transition-colors p-8 mb-10 flex flex-col items-center gap-2 text-center group">
              <span className="w-11 h-11 rounded-full bg-white/5 group-hover:bg-[#CCFF00]/10 flex items-center justify-center transition-colors"><Plus className="w-5 h-5 text-zinc-400 group-hover:text-[#CCFF00]" /></span>
              <span className="text-sm font-bold text-white">Add your best clips</span>
              <span className="text-xs text-zinc-500 max-w-xs">Paste links to your work (YouTube, TikTok, Instagram...) so creators can see your style before they hire you.</span>
            </button>
          ) : (
            <p className="text-sm text-zinc-600 mb-10">No portfolio clips yet.</p>
          )
        ) : (
          <div className="grid sm:grid-cols-3 gap-4 mb-10" data-testid="clipper-portfolio">
            {c.portfolio.map((p, i) => {
              const href = p.url || p.video_url;
              const plat = platformOf(href);
              return (
                <a key={i} href={href} target="_blank" rel="noreferrer" data-testid={`portfolio-item-${i}`}
                  className="relative block rounded-2xl overflow-hidden border border-white/10 hover:border-white/25 group aspect-video bg-gradient-to-br from-white/[0.07] to-white/[0.01] transition-colors">
                  {p.thumb ? (
                    <img src={p.thumb} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><Link2 className="w-7 h-7 text-white/25" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <span className={`absolute top-3 left-3 text-[10px] font-extrabold uppercase tracking-widest ${plat.cls}`}>{plat.name}</span>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold truncate">{p.title || "Watch clip"}</span>
                    <span className="w-8 h-8 rounded-full bg-white/10 backdrop-blur flex items-center justify-center shrink-0 group-hover:bg-[#CCFF00] group-hover:text-black transition-colors"><Play className="w-3.5 h-3.5" fill="currentColor" /></span>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {c.reviews.length > 0 && (
          <>
            <h2 className="font-display font-bold text-xl mb-4">Customer reviews</h2>
            <div className="space-y-4 mb-10">
              {c.reviews.map((r, i) => (
                <div key={i} className="card-dark p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-sm">{r.author}</span>
                    <span className="font-mono text-xs text-zinc-400 flex items-center gap-1"><Star className="w-3 h-3 text-zinc-300" fill="currentColor" />{r.rating}</span>
                  </div>
                  <p className="text-sm text-zinc-400">{r.text}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {!isOwner && (
          <Link to="/customer/create" data-testid="hire-clipper-btn" className="btn-lime h-12 px-10">Post a project for {c.name.split(" ")[0]}</Link>
        )}
      </div>

      {editing && <EditProfile clipper={c} onClose={() => setEditing(false)} onSaved={(u) => { setC(u); setEditing(false); }} />}
    </div>
  );
}

function EditProfile({ clipper, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [name, setName] = useState(clipper.name || "");
  const [specialty, setSpecialty] = useState(clipper.specialty || "");
  const [priceRange, setPriceRange] = useState(clipper.price_range || "");
  const [bio, setBio] = useState(clipper.bio || "");
  const [tools, setTools] = useState(clipper.tools || []);
  const [portfolio, setPortfolio] = useState(
    (clipper.portfolio || []).map((p) => ({ title: p.title || "", video_url: p.url || p.video_url || "" }))
  );
  const [avatarKey, setAvatarKey] = useState(null);
  const [preview, setPreview] = useState(clipper.avatar);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const toolOpts = [...new Set([...TOOL_OPTIONS, ...(clipper.tools || [])])];
  const toggleTool = (t) => setTools((a) => a.includes(t) ? a.filter((x) => x !== t) : [...a, t]);

  const addLink = () => setPortfolio((a) => [...a, { title: "", video_url: "" }]);
  const removeLink = (i) => setPortfolio((a) => a.filter((_, x) => x !== i));
  const updateLink = (i, k, v) => setPortfolio((a) => a.map((it, x) => x === i ? { ...it, [k]: v } : it));

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file");
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const res = await storageAdapter.upload(file, () => {}, { kind: "avatar" });
      if (res.key) setAvatarKey(res.key);
      else toast.error("Upload failed - try again");
    } catch {
      toast.error("Upload failed - try again");
    }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name, specialty, price_range: priceRange, bio, tools,
        portfolio: portfolio
          .filter((p) => p.video_url.trim())
          .map((p) => ({ title: p.title.trim(), video_url: p.video_url.trim() })),
      };
      if (avatarKey) payload.avatar_key = avatarKey;
      const updated = await dbAdapter.updateClipperProfile(payload);
      toast.success("Profile updated");
      onSaved(updated);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not save");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg card-dark p-6 sm:p-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="edit-profile-modal">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-extrabold text-xl tracking-tighter">Edit profile</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* avatar */}
        <div className="flex items-center gap-5 mb-6">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative w-20 h-20 rounded-full overflow-hidden border border-white/15 group shrink-0" data-testid="avatar-picker">
            <img src={preview} alt="" className="w-full h-full object-cover" />
            <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            </span>
          </button>
          <div>
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost h-9 px-4 text-sm">
              {uploading ? "Uploading…" : "Change photo"}
            </button>
            <p className="text-xs text-zinc-600 mt-2">JPG or PNG, square looks best.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} data-testid="avatar-input" />
        </div>

        <div className="space-y-4">
          <Field label="Display name">
            <input className="input-dark" value={name} onChange={(e) => setName(e.target.value)} data-testid="edit-name" />
          </Field>
          <Field label="Specialty">
            <input className="input-dark" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Stream Highlights" data-testid="edit-specialty" />
          </Field>
          <Field label="Typical price range">
            <input className="input-dark" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} placeholder="e.g. $40-$120" data-testid="edit-price" />
          </Field>
          <Field label="Bio">
            <textarea className="input-dark min-h-[90px] py-2" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A line or two on your style and what you deliver." data-testid="edit-bio" maxLength={600} />
          </Field>
          <Field label="Tools you edit in">
            <div className="flex flex-wrap gap-2">
              {toolOpts.map((t) => {
                const on = tools.includes(t);
                return (
                  <button key={t} type="button" onClick={() => toggleTool(t)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-bold transition-colors ${on ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}>
                    {t}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Portfolio links">
            <p className="text-xs text-zinc-600 -mt-1 mb-2.5">Paste links to your best clips - YouTube, TikTok, Instagram, X, Vimeo, Drive. Creators see these on your profile before they hire you.</p>
            <div className="space-y-2.5" data-testid="portfolio-editor">
              {portfolio.map((item, i) => {
                const plat = platformOf(item.video_url);
                return (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 flex gap-2 items-start">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="relative">
                        <Link2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input className="input-dark h-10 pl-8 text-sm" placeholder="Paste clip URL" value={item.video_url}
                          onChange={(e) => updateLink(i, "video_url", e.target.value)} data-testid={`portfolio-url-${i}`} />
                        {item.video_url.trim() && <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold uppercase tracking-widest ${plat.cls}`}>{plat.name}</span>}
                      </div>
                      <input className="input-dark h-9 text-xs" placeholder="Optional title - e.g. Valorant ace montage" value={item.title}
                        onChange={(e) => updateLink(i, "title", e.target.value)} maxLength={120} data-testid={`portfolio-title-${i}`} />
                    </div>
                    <button type="button" onClick={() => removeLink(i)} title="Remove clip"
                      className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border border-white/10 text-zinc-500 hover:text-[#FF4500] hover:border-[#FF4500]/40 transition-colors" data-testid={`portfolio-remove-${i}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addLink} data-testid="add-portfolio-link"
              className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#CCFF00] hover:underline">
              <Plus className="w-4 h-4" /> Add {portfolio.length > 0 ? "another" : "a"} clip link
            </button>
          </Field>
        </div>

        <div className="flex items-center gap-3 mt-8">
          <button onClick={save} disabled={saving || uploading} className="btn-lime h-12 flex-1 justify-center disabled:opacity-50" data-testid="save-profile-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Save changes</>}
          </button>
          <button onClick={onClose} className="btn-ghost h-12 px-5">Cancel</button>
        </div>
      </div>
    </div>
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
