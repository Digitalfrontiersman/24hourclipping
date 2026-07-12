import { useEffect, useState } from "react";
import { dbAdapter } from "@/services/dbAdapter";
import { solanaAdapter } from "@/services/solanaAdapter";
import { notify } from "@/services/notificationAdapter";
import { Wallet, CheckCircle2, Loader2 } from "lucide-react";

// Lets a clipper set the Solana wallet where USDC payouts + tips are received.
export default function SolanaPayoutWallet() {
  const [wallet, setWallet] = useState("");
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dbAdapter.getPayoutWallet().then((r) => { setSaved(r.wallet); setWallet(r.wallet || ""); }).catch(() => {});
  }, []);

  const connect = async () => {
    try {
      const addr = await solanaAdapter.connect();
      setWallet(addr);
      notify.success("Wallet connected", "Address filled in — click Save to use it for payouts.");
    } catch (err) {
      notify.urgent(err?.message || "Could not connect wallet");
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const r = await dbAdapter.setPayoutWallet(wallet.trim());
      setSaved(r.wallet);
      notify.success("Payout wallet saved", "You'll receive USDC payouts and tips here.");
    } catch (err) {
      notify.urgent(err?.response?.data?.detail || "Invalid Solana address");
    }
    setBusy(false);
  };

  return (
    <div className="card-dark p-6 mb-10" data-testid="payout-wallet-card">
      <div className="flex items-center gap-3 mb-4">
        <Wallet className="w-5 h-5 text-[#CCFF00]" />
        <div>
          <span className="label-caps">USDC payout wallet</span>
          <p className="text-xs text-zinc-500 mt-0.5">Where your Solana USDC payouts and tips land. Required to get paid.</p>
        </div>
        {saved && <span className="ml-auto inline-flex items-center gap-1 text-xs text-[#CCFF00]"><CheckCircle2 className="w-4 h-4" /> Set</span>}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          data-testid="payout-wallet-input"
          className="input-dark h-12 text-sm flex-1 font-mono"
          placeholder="Your Solana wallet address"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
        />
        <button data-testid="connect-wallet-btn" className="btn-ghost h-12 px-4 whitespace-nowrap" onClick={connect}>Connect Phantom</button>
        <button data-testid="save-wallet-btn" className="btn-lime h-12 px-6 whitespace-nowrap" disabled={busy || !wallet.trim() || wallet.trim() === saved} onClick={save}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  );
}
