import { useEffect, useState } from "react";
import { dbAdapter } from "@/services/dbAdapter";
import { fmtUSD } from "@/lib/money";
import EmptyState from "@/components/EmptyState";
import Footer from "@/components/Footer";
import { Receipt, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";

const KIND_LABEL = {
  deposit: "Funding", tip: "Tip", payout: "Payout", fee: "Platform fee",
  bond_hold: "Bond hold", bond_release: "Bond release", bond_forfeit: "Bond forfeit",
};

// Format a transaction amount in its own currency.
function money(t) {
  if (t.currency === "usd") return fmtUSD(t.amount);
  return `${t.amount} ${String(t.currency || "").toUpperCase()}`;
}

export default function Billing() {
  const [txns, setTxns] = useState(null);

  useEffect(() => {
    dbAdapter.getTransactions().then(setTxns).catch(() => setTxns([]));
  }, []);

  if (txns === null) {
    return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#CCFF00]" /></div>;
  }

  // Summary tiles (USD only, so mixed currencies never add up wrong).
  const sumUSD = (pred) => txns.filter((t) => t.currency === "usd" && pred(t)).reduce((s, t) => s + t.amount, 0);
  const funded = sumUSD((t) => t.kind === "deposit" && t.direction === "out");
  const tips = sumUSD((t) => t.kind === "tip" && t.direction === "out");
  const received = sumUSD((t) => t.direction === "in");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 flex-1">
        <div className="mb-8">
          <div className="label-caps mb-2">Billing</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter">Payments &amp; history</h1>
          <p className="text-sm text-zinc-500 mt-2">Everything you've funded, tipped, and had returned.</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {[["Total funded", funded], ["Tips sent", tips], ["Received back", received]].map(([l, v]) => (
            <div key={l} className="card-dark p-4 sm:p-5">
              <div className="font-mono text-lg sm:text-2xl font-extrabold">{fmtUSD(v)}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{l}</div>
            </div>
          ))}
        </div>

        {txns.length === 0 ? (
          <EmptyState icon={Receipt} title="No transactions yet" hint="Fund your first clip and it'll show up here." cta="Post a clip" to="/customer/create" />
        ) : (
          <div className="card-dark divide-y divide-white/5 overflow-hidden" data-testid="billing-list">
            {txns.map((t) => {
              const out = t.direction === "out";
              return (
                <div key={t.id} className="flex items-center gap-3 sm:gap-4 p-4" data-testid={`txn-${t.id}`}>
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${out ? "bg-white/5 text-zinc-300" : "bg-[#CCFF00]/10 text-[#CCFF00]"}`}>
                    {out ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{t.project_title || KIND_LABEL[t.kind] || t.kind}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {KIND_LABEL[t.kind] || t.kind}{t.method ? ` · ${t.method}` : ""}{t.created_at ? ` · ${new Date(t.created_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-mono font-bold ${out ? "text-white" : "text-[#CCFF00]"}`}>{out ? "-" : "+"}{money(t)}</div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wider">{t.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
