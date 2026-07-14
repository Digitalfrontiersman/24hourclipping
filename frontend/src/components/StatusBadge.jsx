const LIVE = "border border-white/20 bg-white/[0.05] text-white";

const MAP = {
  open: ["RECEIVING BIDS", "badge-live"],
  draft: ["DRAFT", "border border-zinc-500 text-zinc-400"],
  pending_acceptance: ["PENDING ACCEPTANCE", "border border-amber-400 text-amber-400"],
  contract_live: ["CONTRACT LIVE", LIVE, true],
  live: ["CONTRACT LIVE", LIVE, true],
  awaiting_clipper: ["AWAITING CLIPPER", "border border-amber-400 text-amber-400"],
  delivered: ["DELIVERED", "border border-white text-white"],
  revision: ["IN REVISION", "border border-amber-400 text-amber-400"],
  completed: ["COMPLETED", "border border-zinc-500 text-zinc-400"],
  rescue: ["RESCUE MODE", "badge-urgent"],
  closed_rescued: ["RESCUED & CLOSED", "border border-zinc-500 text-zinc-400"],
};

export default function StatusBadge({ status }) {
  const [label, cls, live] = MAP[status] || [status?.toUpperCase(), "border border-zinc-500 text-zinc-400"];
  return (
    <span data-testid={`status-badge-${status}`} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-widest ${cls}`}>
      {live && <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />}
      {label}
    </span>
  );
}
