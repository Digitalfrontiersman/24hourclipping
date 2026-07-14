import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { dbAdapter } from "@/services/dbAdapter";
import Countdown from "@/components/Countdown";
import StatusBadge from "@/components/StatusBadge";
import JobCard from "@/components/JobCard";
import Footer from "@/components/Footer";
import EmptyState from "@/components/EmptyState";
import { Timer, TrendingUp, ArrowRight, Trophy, X, Search, ShieldAlert, Film, Wallet, ArrowDownToLine } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useNavigate } from "react-router-dom";
import { notify } from "@/services/notificationAdapter";

const SEEN_DEALS_KEY = "24hc_seen_deals";

// Reputation tiers derived from real completed-job counts.
const TIERS = [
  { name: "New Clipper", min: 0 },
  { name: "Rising", min: 5 },
  { name: "Pro", min: 25 },
  { name: "Elite", min: 100 },
];
function reputation(jobs = 0) {
  let cur = TIERS[0], nextT = null;
  for (let i = 0; i < TIERS.length; i++) {
    if (jobs >= TIERS[i].min) { cur = TIERS[i]; nextT = TIERS[i + 1] || null; }
  }
  if (!nextT) return { cur, next: null, pct: 100, remaining: 0 };
  const span = nextT.min - cur.min;
  const pct = Math.max(0, Math.min(100, Math.round(((jobs - cur.min) / span) * 100)));
  return { cur, next: nextT, pct, remaining: nextT.min - jobs };
}

export default function ClipperDashboard() {
  const { user, roles, switchRole } = useApp();
  const nav = useNavigate();
  const ME = user?.id;
  const [me, setMe] = useState(null);
  const [projects, setProjects] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [newWins, setNewWins] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [balance, setBalance] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [ppEmail, setPpEmail] = useState("");
  const [savingPp, setSavingPp] = useState(false);

  const loadBalance = () => dbAdapter.getBalance().then((b) => { setBalance(b); setPpEmail(b.paypal_email || ""); }).catch(() => {});

  const savePaypal = async () => {
    if (!ppEmail.trim() || savingPp) return;
    setSavingPp(true);
    try {
      await dbAdapter.setPaypalEmail(ppEmail.trim());
      notify.success("PayPal email saved");
      loadBalance();
    } catch (err) {
      notify.urgent(err.response?.data?.detail || "Could not save PayPal email");
    } finally {
      setSavingPp(false);
    }
  };

  const withdraw = async () => {
    if (withdrawing) return;
    setWithdrawing(true);
    try {
      const r = await dbAdapter.withdraw("paypal");
      notify.success("Withdrawal sent", r.status === "paid" ? `$${r.amount} on its way to your PayPal.` : `$${r.amount} queued for payout.`);
      loadBalance();
    } catch (err) {
      notify.urgent(err.response?.data?.detail || "Could not withdraw");
    } finally {
      setWithdrawing(false);
    }
  };

  useEffect(() => {
    if (!ME) return;
    dbAdapter.getClipper(ME).then(setMe).catch(() => {});
    dbAdapter.getProjects({ status: "open" }).then(setProjects).catch(() => {});
    dbAdapter.getMyBids().then(setMyBids).catch(() => {});
    loadBalance();
    dbAdapter.getContracts().then((cs) => {
      const mine = cs.filter((c) => c.clipper_id === ME);
      setContracts(mine);
      // "You won" moment - celebrate contracts that just went live and haven't been seen yet.
      const live = mine.filter((c) => ["live", "revision"].includes(c.status));
      let seen = [];
      try { seen = JSON.parse(localStorage.getItem(SEEN_DEALS_KEY) || "[]"); } catch { seen = []; }
      const fresh = live.filter((c) => !seen.includes(c.id));
      if (fresh.length) {
        setNewWins(fresh);
        localStorage.setItem(SEEN_DEALS_KEY, JSON.stringify([...new Set([...seen, ...live.map((c) => c.id)])]));
      }
    }).catch(() => {});
  }, [ME]);

  const active = contracts.filter((c) => ["live", "revision", "delivered"].includes(c.status));
  // Real pending bids - placed by this clipper on jobs still open for bidding.
  const pendingBids = myBids.filter((b) => b.status === "pending" && b.project_status === "open");

  // Accountability: bond staked on running deals and the soonest deadline.
  const running = contracts.filter((c) => ["live", "revision"].includes(c.status));
  const bondAtRisk = running.reduce((sum, c) => sum + (Number(c.bond) || 0), 0);
  const soonest = running.map((c) => c.deadline_at).filter(Boolean).sort()[0];
  const rep = reputation(me?.completed_jobs || 0);
  const alsoCreator = (roles || []).includes("customer");

  const toCreator = async () => {
    try { await switchRole("customer"); nav("/customer"); } catch { /* noop */ }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-4 mb-10 flex-wrap">
          {me && <img src={me.avatar} alt="" className="w-14 h-14 rounded-full border-2 border-white/10" />}
          <div>
            <span className="label-caps">Clipper dashboard</span>
            <h1 className="text-3xl font-extrabold tracking-tighter">{me?.name || "…"}</h1>
          </div>
          <span className="ml-auto badge-live">{rep.cur.name.toUpperCase()}</span>
          {alsoCreator && (
            <button data-testid="switch-to-creator" onClick={toCreator} className="btn-ghost h-9 px-4 text-sm">
              <Film className="w-4 h-4" /> Creator dashboard
            </button>
          )}
        </div>

        {/* Earnings balance + withdraw (PayPal) */}
        <div className="card-dark p-6 mb-10" data-testid="balance-card">
          <div className="flex items-center gap-5 flex-wrap">
            <span className="w-12 h-12 rounded-2xl bg-[#CCFF00]/[0.08] border border-[#CCFF00]/20 flex items-center justify-center shrink-0">
              <Wallet className="w-6 h-6 text-[#CCFF00]" />
            </span>
            <div className="flex-1 min-w-48">
              <div className="label-caps mb-1">Available balance</div>
              <div className="font-display font-extrabold text-3xl tracking-tighter text-[#CCFF00]">
                ${balance ? balance.available.toFixed(2) : "0.00"}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Lifetime earned ${balance ? balance.lifetime_earned.toFixed(2) : "0.00"} · min withdrawal ${balance?.min_withdrawal ?? 20}
              </p>
            </div>
            {balance?.paypal_email && (
              <button
                data-testid="withdraw-btn"
                onClick={withdraw}
                disabled={withdrawing || !balance || balance.available < (balance?.min_withdrawal ?? 20)}
                className="btn-lime h-11 px-6 text-sm shrink-0"
              >
                <ArrowDownToLine className="w-4 h-4" /> {withdrawing ? "Sending…" : "Withdraw to PayPal"}
              </button>
            )}
          </div>
          {/* PayPal destination */}
          <div className="mt-5 pt-5 border-t border-white/[0.06] flex items-center gap-3 flex-wrap">
            <span className="text-xs text-zinc-500 shrink-0">Paid to PayPal</span>
            <input
              data-testid="paypal-email-input"
              type="email"
              value={ppEmail}
              onChange={(e) => setPpEmail(e.target.value)}
              placeholder="you@email.com"
              className="input-dark h-10 text-sm flex-1 min-w-48"
            />
            <button
              data-testid="save-paypal-btn"
              onClick={savePaypal}
              disabled={savingPp || !ppEmail.trim() || ppEmail.trim() === (balance?.paypal_email || "")}
              className="btn-ghost h-10 px-5 text-sm shrink-0"
            >
              {savingPp ? "Saving…" : balance?.paypal_email ? "Update" : "Save"}
            </button>
          </div>
        </div>

        {/* Accountability: bond on the line */}
        {bondAtRisk > 0 && (
          <div className="card-dark p-6 mb-10 flex items-center gap-5 flex-wrap" data-testid="bond-at-risk">
            <ShieldAlert className="w-8 h-8 text-zinc-400 shrink-0" />
            <div className="flex-1 min-w-56">
              <p className="font-display font-extrabold text-xl tracking-tighter">${bondAtRisk} bond on the line</p>
              <p className="text-sm text-zinc-400">Deliver before the clock hits zero or it's forfeited to the creator. On-time keeps your bond <span className="text-white font-semibold">and</span> your streak.</p>
            </div>
            {soonest && (
              <div className="text-right">
                <div className="label-caps mb-1">Soonest deadline</div>
                <div className="font-mono text-2xl font-extrabold text-white"><Countdown deadline={soonest} /></div>
              </div>
            )}
          </div>
        )}

        {/* You won - deal secured celebration */}
        <AnimatePresence>
          {newWins.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="card-dark p-6 mb-10 relative overflow-hidden" data-testid="deal-secured-banner">
              <button data-testid="dismiss-deal-banner" onClick={() => setNewWins([])} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
              <div className="flex items-center gap-3 mb-3">
                <Trophy className="w-6 h-6 text-zinc-300" />
                <div>
                  <p className="font-display font-extrabold text-2xl tracking-tighter text-white">Deal secured{newWins.length > 1 ? ` ×${newWins.length}` : ""}</p>
                  <p className="text-sm text-zinc-300">You won {newWins.length > 1 ? "these bids" : "this bid"} - your 24-hour clock is running. Go deliver.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {newWins.map((c) => (
                  <Link key={c.id} to={`/clipper/room/${c.id}`} data-testid={`won-deal-${c.id}`} className="btn-lime h-10 px-5 text-sm">
                    Open “{c.project?.title || "your project"}” <ArrowRight className="w-4 h-4" />
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {[
            ["Earnings", `$${me?.earnings ?? "-"}`, ""],
            ["Bond balance", `$${me?.bond_balance ?? "-"}`, "text-[#CCFF00]"],
            ["On-time", `${me?.on_time_pct ?? "-"}%`, ""],
            ["Rating", me?.rating ?? "-", ""],
            ["Jobs done", me?.completed_jobs ?? "-", ""],
          ].map(([l, v, cls]) => (
            <div key={l} className="card-dark p-5 hover:border-white/15 transition-colors">
              <div className={`font-mono text-2xl font-extrabold ${cls}`}>{v}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">{l}</div>
            </div>
          ))}
        </div>

        {/* Reputation progress - real, from completed jobs */}
        <div className="card-dark p-6 mb-10 flex items-center gap-5 flex-wrap" data-testid="reputation-progress">
          <TrendingUp className="w-6 h-6 text-zinc-400" />
          <div className="flex-1 min-w-56">
            <div className="flex justify-between text-xs mb-2">
              <span className="font-bold">{rep.cur.name}{rep.next ? ` → ${rep.next.name}` : " - top tier"}</span>
              <span className="text-zinc-500">{rep.next ? `${me?.completed_jobs ?? 0} / ${rep.next.min} jobs` : `${me?.completed_jobs ?? 0} jobs`}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-[#CCFF00] rounded-full transition-[width]" style={{ width: `${rep.pct}%` }} /></div>
          </div>
          <span className="text-xs text-zinc-500">
            {rep.next ? `${rep.remaining} more on-time to ${rep.next.name}: lower bonds, priority placement` : "Elite: lowest bonds, priority placement"}
          </span>
        </div>

        {/* Active countdowns */}
        <h2 className="font-display font-bold text-xl mb-4">Active deals - clock running</h2>
        {active.length === 0 ? (
          <div className="mb-10">
            <EmptyState icon={Search} title="No active deals yet." hint="Win a bid below and it lands here - your 24-hour clock starts the moment you're picked." cta="Find jobs to bid on" to="/marketplace" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {active.map((c) => (
              <Link key={c.id} to={`/clipper/room/${c.id}`} data-testid={`clipper-contract-${c.id}`} className="card-dark p-5 hover:border-white/20 transition-colors">
                <div className="flex items-center justify-between mb-3"><StatusBadge status={c.status} /><span className="font-mono font-bold text-white">${c.price}</span></div>
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
        <div className="mb-10" data-testid="pending-bids">
          {pendingBids.length === 0 ? (
            <div className="card-dark p-5 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Timer className="w-5 h-5 text-zinc-400" />
                <p className="text-sm text-zinc-400">Bids you place appear here until a creator picks you. No bond is locked until you win - then the deal jumps to the top and your clock starts.</p>
              </div>
              <Link to="/marketplace" data-testid="pending-bids-cta" className="btn-ghost h-10 px-5 text-sm shrink-0"><Search className="w-4 h-4" /> Find jobs to bid on</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingBids.map((b) => (
                <Link key={b.id} to={`/clipper/job/${b.project_id}`} data-testid={`pending-bid-${b.id}`}
                  className="card-dark p-4 flex items-center gap-4 flex-wrap hover:border-white/20 transition-colors">
                  <div className="flex-1 min-w-48">
                    <p className="font-bold text-sm truncate">{b.project_title || "Project"}</p>
                    <p className="text-xs text-zinc-500">{b.eta_hours ? `${b.eta_hours}h ETA` : "ETA -"}{b.project_budget != null && ` · $${b.project_budget} budget`}</p>
                  </div>
                  <StatusBadge status="open" />
                  <div className="text-right shrink-0">
                    <div className="font-mono font-extrabold text-[#CCFF00]">${b.amount}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Your bid</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-500 shrink-0" />
                </Link>
              ))}
              <div className="flex justify-end">
                <Link to="/marketplace" data-testid="pending-bids-cta" className="btn-ghost h-10 px-5 text-sm"><Search className="w-4 h-4" /> Find more jobs to bid on</Link>
              </div>
            </div>
          )}
        </div>

        {/* Available jobs */}
        <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-display font-bold text-xl">Available live jobs</h2>
          <Link to="/marketplace" data-testid="view-all-jobs-btn" className="text-sm text-zinc-300 font-bold flex items-center gap-1 hover:text-white transition-colors">Full marketplace <ArrowRight className="w-4 h-4" /></Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.slice(0, 3).map((p) => <JobCard key={p.id} project={p} ctaTo={`/clipper/job/${p.id}`} />)}
        </div>
      </div>
      <Footer />
    </div>
  );
}
