import { Link } from "react-router-dom";
import { Star, BadgeCheck, Play, ArrowUpRight } from "lucide-react";

export default function ClipperCard({ clipper }) {
  const cover = clipper.portfolio?.[0]?.thumb;
  const isFounding = clipper.badge === "Founding Clipper";

  return (
    <Link
      to={`/clippers/${clipper.id}`}
      data-testid={`clipper-card-${clipper.id}`}
      className="card-dark p-5 flex flex-col gap-5 hover:border-[#CCFF00]/40 transition-colors group"
    >
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <img
          src={clipper.avatar}
          alt=""
          className="w-12 h-12 rounded-full object-cover border-2 border-white/10 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display font-bold text-white truncate">{clipper.name}</h3>
            <BadgeCheck className="w-4 h-4 text-[#CCFF00] shrink-0" />
          </div>
          <p className="text-xs text-zinc-500 truncate">{clipper.specialty}</p>
        </div>
        {isFounding && (
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-zinc-300 bg-white/[0.05] border border-white/10 rounded-full px-2.5 py-1">
            Founding
          </span>
        )}
      </div>

      {/* Cover - one clean piece of work, not a cramped grid */}
      {cover && (
        <div className="relative aspect-video rounded-xl overflow-hidden bg-black/40">
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.03] transition duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <span className="absolute bottom-3 left-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm border border-white/25 flex items-center justify-center">
            <Play className="w-3.5 h-3.5 text-white" fill="white" />
          </span>
        </div>
      )}

      {/* Stats - one light line, no boxes */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span className="flex items-center gap-1 text-white font-semibold">
          <Star className="w-3.5 h-3.5 text-[#CCFF00]" fill="#CCFF00" />
          {clipper.rating}
        </span>
        <span className="text-zinc-700">/</span>
        <span>{clipper.on_time_pct}% on time</span>
        <span className="text-zinc-700">/</span>
        <span>{clipper.completed_jobs} jobs</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-600">From</div>
          <div className="font-display font-bold text-white">{clipper.price_range}</div>
        </div>
        <span className="flex items-center gap-1 text-xs font-semibold text-zinc-500 group-hover:text-[#CCFF00] transition-colors">
          View profile <ArrowUpRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
