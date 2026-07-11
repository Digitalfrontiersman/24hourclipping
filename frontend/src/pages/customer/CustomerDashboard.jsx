import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dbAdapter } from "@/services/dbAdapter";
import Countdown from "@/components/Countdown";
import StatusBadge from "@/components/StatusBadge";
import Footer from "@/components/Footer";
import { Plus, Sparkles, Wallet, ArrowRight, LifeBuoy } from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function CustomerDashboard() {
  const [projects, setProjects] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [brand, setBrand] = useState(null);
  const { user } = useApp();

  useEffect(() => {
    dbAdapter.getProjects({ mine: true }).then(setProjects).catch(() => {});
    dbAdapter.getContracts().then(setContracts).catch(() => {});
    dbAdapter.getBrandProfiles().then((b) => setBrand(b[0])).catch(() => {});
  }, []);

  const bidding = projects.filter((p) => p.status === "open");
  const live = contracts.filter((c) => c.status === "live");
  const delivered = contracts.filter((c) => ["delivered", "revision"].includes(c.status));
  const completed = contracts.filter((c) => c.status === "completed");
  const rescue = contracts.filter((c) => c.status === "rescue");
  const spent = completed.reduce((s, c) => s + c.price, 0);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
          <div>
            <span className="label-caps">Customer dashboard</span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter mt-2">Welcome back, {user.name.split(" ")[0]}.</h1>
          </div>
          <Link to="/customer/create" data-testid="dashboard-post-clip-btn" className="btn-lime h-12 px-7"><Plus className="w-4 h-4" /> Post a Clip</Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[["Receiving bids", bidding.length, ""], ["Contracts live", live.length, "text-[#CCFF00]"], ["Awaiting review", delivered.length, "text-[#FF4500]"], ["Credits", `$${user.credits}`, ""]].map(([l, v, cls]) => (
            <div key={l} className="card-dark p-5">
              <div className={`font-mono text-3xl font-extrabold ${cls}`}>{v}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">{l}</div>
            </div>
          ))}
        </div>

        {rescue.length > 0 && (
          <div className="card-dark border-[#FF4500]/50 p-6 mb-10" data-testid="rescue-alert">
            <div className="flex items-center gap-3 flex-wrap justify-between">
              <div className="flex items-center gap-3">
                <LifeBuoy className="w-6 h-6 text-[#FF4500]" />
                <div>
                  <p className="font-display font-bold">Rescue Mode active on {rescue[0].project?.title}</p>
                  <p className="text-sm text-zinc-400">Refund of ${rescue[0].price} + ${rescue[0].bond} bond credited. Relaunch as a priority job.</p>
                </div>
              </div>
              <button data-testid="relaunch-priority-btn" className="btn-coral h-10 px-5 text-sm"
                onClick={() => dbAdapter.relaunch(rescue[0].id).then(() => window.location.reload())}>Relaunch as Priority</button>
            </div>
          </div>
        )}

        {/* Live contracts */}
        <h2 className="font-display font-bold text-xl mb-4">Active project countdowns</h2>
        {live.length === 0 ? <p className="text-zinc-600 text-sm mb-10">No live contracts right now.</p> : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {live.map((c) => (
              <Link key={c.id} to={`/customer/clip-room/${c.id}`} data-testid={`live-contract-${c.id}`} className="card-dark overflow-hidden group hover:border-[#CCFF00]/40 transition-colors">
                <div className="relative aspect-video">
                  <img src={c.project?.thumbnail} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                  <div className="absolute bottom-3 left-4"><StatusBadge status="live" /></div>
                </div>
                <div className="p-5">
                  <h3 className="font-display font-bold mb-1">{c.project?.title}</h3>
                  <p className="text-xs text-zinc-500 mb-3">{c.clipper?.name} · ${c.price}</p>
                  <div className="font-mono text-2xl font-extrabold"><Countdown deadline={c.deadline_at} /></div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Deliveries waiting */}
        {delivered.length > 0 && (
          <>
            <h2 className="font-display font-bold text-xl mb-4">Deliveries waiting for review</h2>
            <div className="space-y-3 mb-10">
              {delivered.map((c) => (
                <div key={c.id} className="card-dark p-4 flex items-center gap-4 flex-wrap" data-testid={`delivery-row-${c.id}`}>
                  <img src={c.project?.thumbnail} alt="" className="w-20 aspect-video object-cover rounded-lg" />
                  <div className="flex-1 min-w-40">
                    <p className="font-bold text-sm">{c.project?.title}</p>
                    <p className="text-xs text-zinc-500">{c.clipper?.name} · v{c.versions.length}</p>
                  </div>
                  <StatusBadge status={c.status} />
                  <Link to={`/customer/review/${c.id}`} data-testid={`review-delivery-btn-${c.id}`} className="btn-white h-10 px-5 text-sm">Review <ArrowRight className="w-4 h-4" /></Link>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Projects receiving bids */}
        <h2 className="font-display font-bold text-xl mb-4">Projects receiving bids</h2>
        <div className="space-y-3 mb-10">
          {bidding.slice(0, 5).map((p) => (
            <div key={p.id} className="card-dark p-4 flex items-center gap-4 flex-wrap" data-testid={`bidding-row-${p.id}`}>
              <img src={p.thumbnail} alt="" className="w-20 aspect-video object-cover rounded-lg" />
              <div className="flex-1 min-w-40">
                <p className="font-bold text-sm">{p.title}</p>
                <p className="text-xs text-zinc-500">${p.budget} budget · {p.bids_count} bids</p>
              </div>
              <StatusBadge status="open" />
              <Link to={`/customer/bids/${p.id}`} data-testid={`view-bids-btn-${p.id}`} className="btn-lime h-10 px-5 text-sm">View Live Bids</Link>
            </div>
          ))}
        </div>

        {/* Completed + brand + credits */}
        <div className="grid lg:grid-cols-3 gap-6 mb-10">
          <div className="card-dark p-6">
            <h3 className="font-display font-bold mb-3">Completed clips</h3>
            {completed.length === 0 ? <p className="text-sm text-zinc-600">Nothing completed yet.</p> :
              completed.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-zinc-300 truncate mr-3">{c.project?.title}</span>
                  <span className="font-mono text-sm text-[#CCFF00]">${c.price}</span>
                </div>
              ))}
          </div>
          <div className="card-dark p-6">
            <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-[#CCFF00]" /><h3 className="font-display font-bold">Saved Brand Profile</h3></div>
            {brand ? (
              <>
                <p className="font-bold text-sm">{brand.name}</p>
                <p className="text-xs text-zinc-500 mb-4 line-clamp-2">{brand.description}</p>
                <Link to="/customer/brand" data-testid="edit-brand-btn" className="btn-ghost h-9 px-4 text-xs">Edit brand profile</Link>
              </>
            ) : <p className="text-sm text-zinc-600">No brand profile yet.</p>}
          </div>
          <div className="card-dark p-6">
            <div className="flex items-center gap-2 mb-3"><Wallet className="w-4 h-4 text-[#CCFF00]" /><h3 className="font-display font-bold">Credits & spending</h3></div>
            <div className="flex justify-between text-sm py-1.5"><span className="text-zinc-500">Available credits</span><span className="font-mono font-bold">${user.credits}</span></div>
            <div className="flex justify-between text-sm py-1.5"><span className="text-zinc-500">Total spent</span><span className="font-mono font-bold">${spent}</span></div>
            <div className="flex justify-between text-sm py-1.5"><span className="text-zinc-500">Bond credits earned</span><span className="font-mono font-bold text-[#CCFF00]">$13</span></div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
