import { Link } from "react-router-dom";
import { Clock, MessagesSquare, Shield, Crop, Captions, Film, BadgeCheck } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

export default function JobCard({ project, ctaTo, ctaLabel = "Bid Now" }) {
  return (
    <Link to={ctaTo} data-testid={`job-card-${project.id}`} className="card-dark overflow-hidden flex flex-col h-full group hover:border-[#CCFF00]/40 transition-colors">
      <div className="relative aspect-video overflow-hidden">
        <img src={project.thumbnail} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          <span className="rounded-full bg-black/70 backdrop-blur px-3 py-1 text-xs font-bold text-white">{project.category}</span>
          {project.official && (
            <span title="Verified platform listing" className="inline-flex items-center gap-1 rounded-full bg-[#CCFF00] px-2.5 py-1 text-[10px] font-extrabold text-black">
              <BadgeCheck className="w-3 h-3" /> VERIFIED
            </span>
          )}
          {project.priority && <span className="badge-urgent bg-black/70">PRIORITY</span>}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div>
            <div className="font-mono text-2xl font-extrabold text-[#CCFF00]">${project.budget}</div>
            <div className="text-xs text-zinc-400">{project.customer_name}</div>
          </div>
          <span className="badge-live bg-black/70">
            {project.bids_count} bids
          </span>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display font-bold text-white leading-snug mb-3 group-hover:text-[#CCFF00] transition-colors">{project.title}</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-zinc-400 mb-4">
          <span className="flex items-center gap-1.5"><Film className="w-3.5 h-3.5" /> Source {project.source_length}</span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Output {project.output_length}</span>
          <span className="flex items-center gap-1.5"><Crop className="w-3.5 h-3.5" /> {project.aspect_ratio}</span>
          <span className="flex items-center gap-1.5"><Captions className="w-3.5 h-3.5" /> {project.captions}</span>
          <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Bond ${project.bond}</span>
          <span className="flex items-center gap-1.5"><MessagesSquare className="w-3.5 h-3.5" /> {dayjs(project.posted_at).fromNow()}</span>
        </div>
        <div className="mt-auto">
          <span data-testid={`job-card-cta-${project.id}`} className="btn-lime w-full h-11 text-sm">{ctaLabel}</span>
        </div>
      </div>
    </Link>
  );
}
