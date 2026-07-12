import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { dbAdapter } from "@/services/dbAdapter";
import JobCard from "@/components/JobCard";
import Footer from "@/components/Footer";
import { useApp } from "@/context/AppContext";
import { CATEGORIES } from "@/data/demoVideos";
import { SlidersHorizontal, LayoutGrid, List, Shield, Clock } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

const BUDGETS = [
  { label: "Any budget", min: 0, max: 9999 },
  { label: "$20 – $49", min: 20, max: 49 },
  { label: "$50 – $99", min: 50, max: 99 },
  { label: "$100 – $500", min: 100, max: 500 },
];

export default function Marketplace() {
  const { user } = useApp();
  // Owners (and admins) open a job into its bid room (see bids + submissions);
  // everyone else opens the clipper job page to bid.
  const ownsJob = (p) => user && (p.owner_id === user.id || user.role === "admin");
  const jobLink = (p) => ownsJob(p) ? `/customer/bids/${p.id}` : `/clipper/job/${p.id}`;
  const jobLabel = (p) => ownsJob(p) ? "Open Job" : "Bid Now";
  const [projects, setProjects] = useState(null);
  const [cat, setCat] = useState("All");
  const [budget, setBudget] = useState(0);
  const [moment, setMoment] = useState("all");
  const [view, setView] = useState(() => localStorage.getItem("24hc_jobs_view") || "grid");

  const setViewMode = (v) => {
    setView(v);
    localStorage.setItem("24hc_jobs_view", v);
  };

  useEffect(() => {
    dbAdapter.getProjects({ status: "open" }).then(setProjects).catch(() => setProjects([]));
  }, []);

  const filtered = (projects || []).filter((p) => {
    if (cat !== "All" && p.category !== cat) return false;
    const b = BUDGETS[budget];
    if (p.budget < b.min || p.budget > b.max) return false;
    if (moment === "timestamp" && !p.timestamp_provided) return false;
    if (moment === "find" && p.timestamp_provided) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter">Open projects</h1>
            <p className="text-sm text-zinc-500 mt-2">Browse briefs from creators and place your bid.</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-zinc-500">{filtered.length} open for bids</p>
            <div className="flex items-center gap-1 bg-[#1A1A1A] border border-white/10 rounded-full p-1" data-testid="view-toggle">
              <button data-testid="view-grid-btn" onClick={() => setViewMode("grid")} aria-label="Grid view"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${view === "grid" ? "bg-[#CCFF00] text-black" : "text-zinc-400 hover:text-white"}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button data-testid="view-list-btn" onClick={() => setViewMode("list")} aria-label="List view"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${view === "list" ? "bg-[#CCFF00] text-black" : "text-zinc-400 hover:text-white"}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card-dark p-4 mb-8 space-y-3" data-testid="marketplace-filters">
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="w-4 h-4 text-zinc-500" />
            {["All", ...CATEGORIES].map((c) => (
              <button key={c} data-testid={`filter-cat-${c.toLowerCase().replace(/\s/g, "-")}`} onClick={() => setCat(c)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${cat === c ? "bg-[#CCFF00] text-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {BUDGETS.map((b, i) => (
              <button key={b.label} data-testid={`filter-budget-${i}`} onClick={() => setBudget(i)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold font-mono transition-colors ${budget === i ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:text-white"}`}>
                {b.label}
              </button>
            ))}
            <span className="w-px h-5 bg-white/10 mx-1" />
            {[["all", "All moments"], ["timestamp", "Timestamp provided"], ["find", "Find the best moment"]].map(([v, l]) => (
              <button key={v} data-testid={`filter-moment-${v}`} onClick={() => setMoment(v)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${moment === v ? "bg-[#FF4500] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {projects === null ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{[...Array(6)].map((_, i) => <div key={i} className="card-dark h-96 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="card-dark p-16 text-center" data-testid="marketplace-empty">
            <p className="font-display font-bold text-xl mb-2">No jobs match those filters.</p>
            <p className="text-zinc-500 text-sm">Try widening the budget or category.</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p) => <JobCard key={p.id} project={p} ctaTo={jobLink(p)} ctaLabel={jobLabel(p)} />)}
          </div>
        ) : (
          <div className="space-y-3" data-testid="jobs-list-view">
            {filtered.map((p, i) => (
              <motion.div key={p.id} initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.04 }}
                className="card-dark p-3 sm:p-4 flex items-center gap-4 hover:border-white/25 transition-colors" data-testid={`job-row-${p.id}`}>
                <img src={p.thumbnail} alt={p.title} className="w-24 sm:w-28 aspect-video object-cover rounded-xl shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-sm sm:text-base truncate">{p.title}</h3>
                    {p.priority && <span className="badge-urgent text-[9px] px-2 py-0.5">PRIORITY</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 flex-wrap">
                    <span className="rounded-full bg-white/5 px-2.5 py-0.5 font-bold text-zinc-300">{p.category}</span>
                    <span className="hidden sm:flex items-center gap-1"><Clock className="w-3 h-3" /> {p.output_length} · {p.aspect_ratio}</span>
                    <span className="hidden md:flex items-center gap-1"><Shield className="w-3 h-3" /> Bond ${p.bond}</span>
                    <span className="text-zinc-600">{dayjs(p.posted_at).fromNow()}</span>
                  </div>
                </div>
                <span className="badge-live hidden sm:inline-flex shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" /> {p.bids_count} bids
                </span>
                <div className="text-right shrink-0">
                  <div className="font-mono font-extrabold text-lg sm:text-xl text-[#CCFF00]">${p.budget}</div>
                  <div className="text-[10px] text-zinc-500 truncate max-w-20">{p.customer_name}</div>
                </div>
                <Link to={jobLink(p)} data-testid={`job-row-cta-${p.id}`} className="btn-lime h-10 px-5 text-xs shrink-0">{jobLabel(p)}</Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
