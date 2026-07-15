import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { dbAdapter } from "@/services/dbAdapter";
import JobCard from "@/components/JobCard";
import JobCardSkeleton from "@/components/JobCardSkeleton";
import Seo from "@/components/Seo";
import { useApp } from "@/context/AppContext";
import { CATEGORIES } from "@/data/demoVideos";
import { LayoutGrid, List, Shield, Clock, BadgeCheck } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

const BUDGETS = [
  { label: "Any budget", min: 0, max: 9999 },
  { label: "$20 to $49", min: 20, max: 49 },
  { label: "$50 to $99", min: 50, max: 99 },
  { label: "$100 to $500", min: 100, max: 500 },
];

const MOMENTS = [
  { value: "all", label: "All moments" },
  { value: "timestamp", label: "Timestamp provided" },
  { value: "find", label: "Find the best moment" },
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
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <Seo title="Live clipping jobs" path="/marketplace" description="Browse open short-form clipping jobs from creators and place your bid. Vetted clippers deliver finished clips within 24 hours on 24 Hour Clipping." />
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 flex-1">
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

        {/* Filters: one calm category row + two compact dropdowns */}
        <div className="flex items-center gap-3 mb-8 flex-wrap sm:flex-nowrap" data-testid="marketplace-filters">
          <div className="order-2 sm:order-1 flex-1 min-w-0 flex items-center gap-1 flex-nowrap overflow-x-auto -mx-4 px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
            {["All", ...CATEGORIES].map((c) => (
              <button key={c} data-testid={`filter-cat-${c.toLowerCase().replace(/\s/g, "-")}`} onClick={() => setCat(c)}
                className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${cat === c ? "bg-[#CCFF00] text-black" : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="order-1 sm:order-2 flex items-center gap-2 shrink-0">
            <Select value={String(budget)} onValueChange={(v) => setBudget(Number(v))}>
              <SelectTrigger data-testid="filter-budget" className="h-10 w-[136px] rounded-full bg-white/[0.04] border-white/10 text-xs font-semibold text-zinc-300 hover:text-white hover:border-white/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUDGETS.map((b, i) => <SelectItem key={b.label} value={String(i)}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={moment} onValueChange={setMoment}>
              <SelectTrigger data-testid="filter-moment" className="h-10 w-[150px] rounded-full bg-white/[0.04] border-white/10 text-xs font-semibold text-zinc-300 hover:text-white hover:border-white/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOMENTS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {projects === null ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{[...Array(6)].map((_, i) => <JobCardSkeleton key={i} />)}</div>
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
                    {p.official && <span title="Verified platform listing" className="inline-flex items-center gap-1 rounded-full bg-[#CCFF00] px-2 py-0.5 text-[9px] font-extrabold text-black"><BadgeCheck className="w-3 h-3" /> VERIFIED</span>}
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
                  {p.bids_count} bids
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
    </div>
  );
}
