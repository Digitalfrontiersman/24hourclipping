import { Link } from "react-router-dom";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] bg-[#0A0A0A] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="font-display font-extrabold text-7xl sm:text-8xl tracking-tighter text-[#CCFF00]">404</div>
        <h1 className="font-display font-bold text-2xl mt-4">This page took a hard cut.</h1>
        <p className="text-zinc-500 mt-2">The page you're looking for doesn't exist or has moved. Let's get you back on the clock.</p>
        <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
          <Link to="/" className="btn-lime h-11 px-6 text-sm"><Home className="w-4 h-4" /> Home</Link>
          <Link to="/marketplace" className="btn-ghost h-11 px-6 text-sm"><Search className="w-4 h-4" /> Browse jobs</Link>
        </div>
      </div>
    </div>
  );
}
