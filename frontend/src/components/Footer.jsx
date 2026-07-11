import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0A0A0A] py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 font-display font-extrabold tracking-tighter mb-2">
            <span className="w-7 h-7 rounded-full bg-[#CCFF00] flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-black" fill="black" /></span>
            Clip<span className="text-[#CCFF00]">24</span>
          </div>
          <p className="text-sm text-zinc-500">Friction is fiction. First cuts in 24 hours.</p>
        </div>
        <div className="flex gap-8 text-sm text-zinc-400">
          <Link to="/marketplace" className="hover:text-white transition-colors">Live Jobs</Link>
          <Link to="/clippers" className="hover:text-white transition-colors">Clippers</Link>
          <Link to="/clipper/onboarding" className="hover:text-white transition-colors">Become a Clipper</Link>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-600 border border-white/10 rounded-full px-4 py-2" data-testid="solana-badge">
          <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#CCFF00] to-emerald-400" />
          Payments powered by Solana
        </div>
      </div>
    </footer>
  );
}
