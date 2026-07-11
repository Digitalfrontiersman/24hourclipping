import { useEffect, useState } from "react";
import { dbAdapter } from "@/services/dbAdapter";
import JobCard from "@/components/JobCard";
import Footer from "@/components/Footer";
import { CATEGORIES } from "@/data/demoVideos";
import { SlidersHorizontal } from "lucide-react";

const BUDGETS = [
  { label: "Any budget", min: 0, max: 9999 },
  { label: "$20 – $49", min: 20, max: 49 },
  { label: "$50 – $99", min: 50, max: 99 },
  { label: "$100 – $500", min: 100, max: 500 },
];

export default function Marketplace() {
  const [projects, setProjects] = useState(null);
  const [cat, setCat] = useState("All");
  const [budget, setBudget] = useState(0);
  const [moment, setMoment] = useState("all");

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
            <span className="badge-live mb-3"><span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" /> LIVE JOB FEED</span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter mt-3">Live Job Marketplace</h1>
          </div>
          <p className="text-sm text-zinc-500">{filtered.length} open projects receiving bids</p>
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
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p) => <JobCard key={p.id} project={p} ctaTo={`/clipper/job/${p.id}`} />)}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
