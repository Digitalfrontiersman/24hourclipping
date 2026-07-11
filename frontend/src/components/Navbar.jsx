import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Zap, ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const ROLE_HOME = { customer: "/customer", clipper: "/clipper", admin: "/admin" };
const ROLE_LABEL = { customer: "Customer", clipper: "Clipper", admin: "Admin" };

export default function Navbar() {
  const { role, switchRole } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/marketplace", label: "Live Jobs" },
    { to: "/clippers", label: "Clippers" },
    { to: ROLE_HOME[role], label: "Dashboard" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2 font-display font-extrabold text-lg tracking-tighter">
          <span className="w-8 h-8 rounded-full bg-[#CCFF00] flex items-center justify-center"><Zap className="w-4 h-4 text-black" fill="black" /></span>
          <span>24HR<span className="text-[#CCFF00]">CLIPPING</span></span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link key={l.to} to={l.to} data-testid={`nav-link-${l.label.toLowerCase().replace(" ", "-")}`}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${loc.pathname === l.to ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"}`}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger data-testid="role-switcher" className="btn-ghost h-9 px-4 text-sm">
              <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
              {ROLE_LABEL[role]} <ChevronDown className="w-3.5 h-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#1A1A1A] border-white/10 text-white">
              {Object.keys(ROLE_LABEL).map((r) => (
                <DropdownMenuItem key={r} data-testid={`role-option-${r}`} className="cursor-pointer focus:bg-white/10 focus:text-white"
                  onClick={() => { switchRole(r); nav(ROLE_HOME[r]); }}>
                  Switch to {ROLE_LABEL[r]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button className="md:hidden text-white" data-testid="mobile-menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/10 px-4 py-3 flex flex-col gap-1 bg-[#0A0A0A]">
          {links.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-semibold text-zinc-300 hover:bg-white/5">
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
