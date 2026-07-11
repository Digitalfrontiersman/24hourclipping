import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { dbAdapter } from "@/services/dbAdapter";
import Footer from "@/components/Footer";
import { Star, BadgeCheck, Timer, Play, ArrowLeft } from "lucide-react";

export default function ClipperProfile() {
  const { id } = useParams();
  const [c, setC] = useState(null);

  useEffect(() => {
    dbAdapter.getClipper(id).then(setC).catch(() => {});
  }, [id]);

  if (!c) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><div className="card-dark w-full max-w-3xl h-96 mx-4 animate-pulse" /></div>;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/clippers" className="text-sm text-zinc-500 hover:text-white flex items-center gap-2 mb-8 transition-colors" data-testid="back-to-directory"><ArrowLeft className="w-4 h-4" /> Directory</Link>

        <div className="flex flex-col sm:flex-row items-start gap-6 mb-10">
          <img src={c.avatar} alt={c.name} className="w-24 h-24 rounded-full border-2 border-[#CCFF00]/50" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-extrabold tracking-tighter">{c.name}</h1>
              <BadgeCheck className="w-6 h-6 text-[#CCFF00]" />
              <span className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-3 py-1 border ${c.badge === "Founding Clipper" ? "border-[#CCFF00] text-[#CCFF00]" : "border-white/30 text-zinc-300"}`}>{c.badge}</span>
            </div>
            <p className="text-zinc-400 mt-1">{c.specialty} · {c.price_range}</p>
          </div>
        </div>

        {/* On-time hero stat */}
        <div className="grid sm:grid-cols-4 gap-4 mb-10">
          <div className="card-dark p-6 sm:col-span-2 border-[#CCFF00]/30">
            <div className="label-caps mb-1">On-time delivery — the score that matters</div>
            <div className="font-mono text-5xl font-extrabold text-[#CCFF00] flex items-center gap-3"><Timer className="w-8 h-8" />{c.on_time_pct}%</div>
            <div className="text-xs text-zinc-500 mt-2">{c.missed_deadlines} missed deadlines · {c.completed_jobs} completed jobs</div>
          </div>
          <div className="card-dark p-6">
            <div className="label-caps mb-1">Overall</div>
            <div className="font-mono text-4xl font-extrabold flex items-center gap-2"><Star className="w-6 h-6 text-[#CCFF00]" fill="#CCFF00" />{c.rating}</div>
          </div>
          <div className="card-dark p-6">
            <div className="label-caps mb-1">Repeat clients</div>
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

        <h2 className="font-display font-bold text-xl mb-4">Portfolio</h2>
        <div className="grid sm:grid-cols-3 gap-4 mb-10" data-testid="clipper-portfolio">
          {c.portfolio.map((p, i) => (
            <div key={i} className="relative rounded-2xl overflow-hidden border border-white/10 group cursor-pointer">
              <img src={p.thumb} alt={p.title} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <span className="text-xs font-bold">{p.title}</span>
                <span className="w-8 h-8 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"><Play className="w-3.5 h-3.5" fill="white" /></span>
              </div>
            </div>
          ))}
        </div>

        <h2 className="font-display font-bold text-xl mb-4">Customer reviews</h2>
        <div className="space-y-4 mb-10">
          {c.reviews.map((r, i) => (
            <div key={i} className="card-dark p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-sm">{r.author}</span>
                <span className="font-mono text-xs text-[#CCFF00] flex items-center gap-1"><Star className="w-3 h-3" fill="#CCFF00" />{r.rating}</span>
              </div>
              <p className="text-sm text-zinc-400">{r.text}</p>
            </div>
          ))}
        </div>

        <Link to="/customer/create" data-testid="hire-clipper-btn" className="btn-lime h-14 px-10">Post a project for {c.name.split(" ")[0]}</Link>
      </div>
      <Footer />
    </div>
  );
}
