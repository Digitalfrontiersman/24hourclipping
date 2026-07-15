import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0A0A0A] py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 font-display font-extrabold tracking-tighter mb-2">
            <span className="w-7 h-7 rounded-full bg-[#CCFF00] flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-black" fill="black" /></span>
            24HR<span className="text-[#CCFF00]">CLIPPING</span>
          </div>
          <p className="text-sm text-zinc-500">Friction is fiction. First cuts in 24 hours.</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:gap-8 gap-x-8 gap-y-2 text-sm text-zinc-400">
          <Link to="/marketplace" className="hover:text-white transition-colors">Live Jobs</Link>
          <Link to="/clippers" className="hover:text-white transition-colors">Clippers</Link>
          <a href="/blog" className="hover:text-white transition-colors">Blog</a>
          <Link to="/docs" className="hover:text-white transition-colors">Docs</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="/cookies" className="hover:text-white transition-colors">Cookies</Link>
        </div>
        <div className="text-xs text-zinc-600" data-testid="footer-meta">
          &copy; {new Date().getFullYear()} 24 Hour Clipping
        </div>
      </div>
    </footer>
  );
}
