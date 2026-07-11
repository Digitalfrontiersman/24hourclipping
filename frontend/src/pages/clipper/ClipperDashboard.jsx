import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dbAdapter } from "@/services/dbAdapter";
import Countdown from "@/components/Countdown";
import StatusBadge from "@/components/StatusBadge";
import JobCard from "@/components/JobCard";
import Footer from "@/components/Footer";
import { Star, Timer, TrendingUp, ArrowRight } from "lucide-react";

const ME = "clipper-1";

export default function ClipperDashboard() {
  const [me, setMe] = useState(null);
  const [projects, setProjects] = useState([]);
  const [contracts, setContracts] = useState([]);

  useEffect(() => {
    dbAdapter.getClipper(ME).then(setMe).catch(() => {});
    dbAdapter.getProjects({ status: "open" }).then(setProjects).catch(() => {});
    dbAdapter.getContracts().then((cs) => setContracts(cs.filter((c) => c.clipper_id === ME))).catch(() => {});
  }, []);

  const active = contracts.filter((c) => ["live", "revision", "delivered"].includes(c.status));

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-4 mb-10 flex-wrap">
          {me && <img src={me.avatar} alt="" className="w-14 h-14 rounded-full border-2 border-[#CCFF00]/50" />}
          <div>
            <span className="label-caps">Clipper dashboard</span>
            <h1 className="text-3xl font-extrabold tracking-tighter">{me?.name || "…"}</h1>
          </div>
          <span className="ml-auto badge-live">{me?.badge?.toUpperCase() || ""}</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {[
            ["Earnings", `$${me?.earnings ?? "—"}`, "text-[#CCFF00]"],
            ["Bond balance", `$${me?.bond_balance ?? "—"}`, ""],
            ["On-time", `${me?.on_time_pct ?? "—"}%`, "text-[#CCFF00]"],
            ["Rating", me?.rating ?? "—", ""],
            ["Jobs done", me?.completed_jobs ?? "—", ""],
          ].map(([l, v, cls]) => (
            <div key={l} className="card-dark p-5">
              <div className={`font-mono text-2xl font-extrabold ${cls}`}>{v}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">{l}</div>
            </div>
          ))}
        </div>

        {/* Marketplace progress */}
        <div className="card-dark p-6 mb-10 flex items-center gap-5 flex-wrap" data-testid="marketplace-progress">
          <TrendingUp className="w-6 h-6 text-[#CCFF00]" />
          <div className="flex-1 min-w-56">
            <div className="flex justify-between text-xs mb-2"><span className="font-bold">Founding Clipper → Elite tier</span><span className="text-zinc-500">214 / 250 jobs</span></div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-[#CCFF00] rounded-full" style={{ width: "85%" }} /></div>
          </div>
          <span className="text-xs text-zinc-500">36 jobs to Elite: lower bonds, priority placement</span>
        </div>

        {/* Active countdowns */}
        <h2 className="font-display font-bold text-xl mb-4">Active project countdowns</h2>
        {active.length === 0 ? <p className="text-zinc-600 text-sm mb-10">No active contracts.</p> : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {active.map((c) => (
              <Link key={c.id} to={`/clipper/room/${c.id}`} data-testid={`clipper-contract-${c.id}`} className="card-dark p-5 hover:border-[#CCFF00]/40 transition-colors">
                <div className="flex items-center justify-between mb-3"><StatusBadge status={c.status} /><span className="font-mono font-bold text-[#CCFF00]">${c.price}</span></div>
                <h3 className="font-display font-bold mb-2">{c.project?.title}</h3>
                {c.status === "live" || c.status === "revision" ? (
                  <div className="font-mono text-2xl font-extrabold"><Countdown deadline={c.deadline_at} /></div>
                ) : <p className="text-sm text-zinc-500">Waiting on customer review</p>}
                <div className="text-xs text-zinc-500 mt-2 flex items-center gap-1"><Timer className="w-3 h-3" /> Bond ${c.bond} locked</div>
              </Link>
            ))}
          </div>
        )}

        {/* Pending bids */}
        <h2 className="font-display font-bold text-xl mb-4">Pending bids</h2>
        <div className="card-dark p-5 mb-10 flex items-center justify-between flex-wrap gap-3" data-testid="pending-bids">
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-[#CCFF00]" />
            <p className="text-sm text-zinc-400">Your bid of <span className="font-mono font-bold text-white">$78</span> on “Ranked Grand Finals Clutch Moment” is pending. Bond not locked until accepted.</p>
          </div>
          <StatusBadge status="open" />
        </div>

        {/* Available jobs */}
        <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-display font-bold text-xl">Available live jobs</h2>
          <Link to="/marketplace" data-testid="view-all-jobs-btn" className="text-sm text-[#CCFF00] font-bold flex items-center gap-1 hover:underline">Full marketplace <ArrowRight className="w-4 h-4" /></Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.slice(0, 3).map((p) => <JobCard key={p.id} project={p} ctaTo={`/clipper/job/${p.id}`} />)}
        </div>
      </div>
      <Footer />
    </div>
  );
}
