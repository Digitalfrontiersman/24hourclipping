import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { ROLE_HOME, ROLE_NOUN } from "@/lib/roles";
import { toast } from "sonner";
import { Zap, ChevronDown, Menu, X, LogOut, User, LayoutDashboard, Repeat, Shield } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const { user, roles, activeRole, isAuthed, onboarded, switchRole, logout } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const dashboardHref = isAuthed ? (onboarded ? ROLE_HOME[activeRole] : "/onboarding") : "/login";
  const links = [
    { to: "/marketplace", label: "Live Jobs" },
    { to: "/clippers", label: "Clippers" },
    { to: dashboardHref, label: "Dashboard" },
  ];

  // Real mode switch for multi-role accounts — flips the active dashboard, no re-login.
  const otherRoles = (roles || []).filter((r) => r !== activeRole && r !== "admin");

  const switchTo = async (r) => {
    try {
      await switchRole(r);
      nav(ROLE_HOME[r]);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not switch");
    }
  };

  const profileHref = activeRole === "clipper" ? `/clippers/${user?.id}` : "/customer/brand";

  const doLogout = () => {
    logout();
    nav("/");
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2 font-display font-extrabold text-lg tracking-tighter">
          <span className="w-8 h-8 rounded-full bg-[#CCFF00] flex items-center justify-center"><Zap className="w-4 h-4 text-black" fill="black" /></span>
          <span>Clip<span className="text-[#CCFF00]">24</span></span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link key={l.label} to={l.to} data-testid={`nav-link-${l.label.toLowerCase().replace(" ", "-")}`}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${loc.pathname === l.to ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"}`}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {isAuthed ? (
            <DropdownMenu>
              <DropdownMenuTrigger data-testid="account-menu" className="btn-ghost h-9 px-4 text-sm">
                <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
                {user?.name?.split(" ")[0] || "Account"} <ChevronDown className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1A1A1A] border-white/10 text-white w-60">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-sm">{user?.name}</span>
                  <span className="text-xs text-zinc-500 font-normal flex items-center gap-1"><User className="w-3 h-3" /> {user?.email}</span>
                  {onboarded && <span className="text-[10px] mt-1 text-[#CCFF00] font-bold uppercase tracking-wide">Viewing as {ROLE_NOUN[activeRole]}</span>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />

                <DropdownMenuItem data-testid="menu-dashboard" className="cursor-pointer focus:bg-white/10 focus:text-white" onClick={() => nav(dashboardHref)}>
                  <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                </DropdownMenuItem>
                {onboarded && (
                  <DropdownMenuItem className="cursor-pointer focus:bg-white/10 focus:text-white" onClick={() => nav(profileHref)}>
                    <User className="w-3.5 h-3.5" /> Profile
                  </DropdownMenuItem>
                )}

                {otherRoles.length > 0 && <DropdownMenuSeparator className="bg-white/10" />}
                {otherRoles.map((r) => (
                  <DropdownMenuItem key={r} data-testid={`switch-to-${r}`} className="cursor-pointer focus:bg-white/10 focus:text-white"
                    onClick={() => switchTo(r)}>
                    <Repeat className="w-3.5 h-3.5" /> Switch to {ROLE_NOUN[r]}
                  </DropdownMenuItem>
                ))}

                {roles?.includes("admin") && (
                  <>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem className="cursor-pointer focus:bg-white/10 focus:text-white" onClick={() => nav("/admin")}>
                      <Shield className="w-3.5 h-3.5" /> Admin
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem data-testid="logout-btn" className="cursor-pointer focus:bg-white/10 focus:text-white text-red-400" onClick={doLogout}>
                  <LogOut className="w-3.5 h-3.5" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/login" data-testid="nav-login" className="btn-ghost h-9 px-4 text-sm">Log in</Link>
              <Link to="/register" data-testid="nav-register" className="btn-lime h-9 px-4 text-sm hidden sm:flex">Sign up</Link>
            </>
          )}
          <button className="md:hidden text-white" data-testid="mobile-menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/10 px-4 py-3 flex flex-col gap-1 bg-[#0A0A0A]">
          {links.map((l) => (
            <Link key={l.label} to={l.to} onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-semibold text-zinc-300 hover:bg-white/5">
              {l.label}
            </Link>
          ))}
          {isAuthed && otherRoles.map((r) => (
            <button key={r} onClick={() => { setOpen(false); switchTo(r); }} className="text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-[#CCFF00] hover:bg-white/5">
              Switch to {ROLE_NOUN[r]}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
