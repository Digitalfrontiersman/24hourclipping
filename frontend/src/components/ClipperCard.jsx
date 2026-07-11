import { Link } from "react-router-dom";
import { Star, BadgeCheck, Timer } from "lucide-react";

export default function ClipperCard({ clipper }) {
  return (
    <Link to={`/clippers/${clipper.id}`} data-testid={`clipper-card-${clipper.id}`}
      className="card-dark p-6 flex flex-col gap-4 hover:border-[#CCFF00]/40 transition-colors group">
      <div className="flex items-center gap-4">
        <img src={clipper.avatar} alt={clipper.name} className="w-14 h-14 rounded-full object-cover border-2 border-white/10" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display font-bold text-white truncate">{clipper.name}</h3>
            <BadgeCheck className="w-4 h-4 text-[#CCFF00] shrink-0" />
          </div>
          <p className="text-xs text-zinc-400">{clipper.specialty}</p>
          <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-widest ${clipper.badge === "Founding Clipper" ? "text-[#CCFF00]" : "text-zinc-400"}`}>{clipper.badge}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-black/40 rounded-xl py-2.5">
          <div className="font-mono font-bold text-white flex items-center justify-center gap-1"><Star className="w-3.5 h-3.5 text-[#CCFF00]" fill="#CCFF00" />{clipper.rating}</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Rating</div>
        </div>
        <div className="bg-black/40 rounded-xl py-2.5">
          <div className="font-mono font-bold text-[#CCFF00] flex items-center justify-center gap-1"><Timer className="w-3.5 h-3.5" />{clipper.on_time_pct}%</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">On-Time</div>
        </div>
        <div className="bg-black/40 rounded-xl py-2.5">
          <div className="font-mono font-bold text-white">{clipper.completed_jobs}</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Jobs</div>
        </div>
      </div>
      <div className="flex gap-1.5">
        {clipper.portfolio.slice(0, 3).map((p, i) => (
          <img key={i} src={p.thumb} alt={p.title} className="w-1/3 aspect-video object-cover rounded-lg opacity-80 group-hover:opacity-100 transition-opacity" />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">Typical range</span>
        <span className="font-mono font-bold text-white">{clipper.price_range}</span>
      </div>
    </Link>
  );
}
