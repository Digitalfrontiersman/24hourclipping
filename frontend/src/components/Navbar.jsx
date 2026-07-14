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

  // Real mode switch for multi-role accounts - flips the active dashboard, no re-login.
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

  const userInitial = (user?.name || "?").trim().charAt(0).toUpperCase() || "?";
  const AvatarCircle = ({ className }) =>
    user?.avatar
      ? <img src={user.avatar} alt="" className={`${className} rounded-full object-cover border border-white/15`} />
      : <span className={`${className} rounded-full bg-[#CCFF00] text-black font-display font-bold flex items-center justify-center leading-none`}>{userInitial}</span>;

  const doLogout = () => {
    logout();
    nav("/");
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2 font-display font-extrabold text-lg tracking-tighter">
          <span className="w-8 h-8 rounded-full bg-[#CCFF00] flex items-center justify-center"><Zap className="w-4 h-4 text-black" fill="black" /></span>
          <span>24HR<span className="text-[#CCFF00]">CLIPPING</span></span>
        </Link>

        <div className="hidden md:flex items-center h-16 gap-2">
          {links.map((l) => {
            const active = loc.pathname === l.to;
            return (
              <Link key={l.label} to={l.to} data-testid={`nav-link-${l.label.toLowerCase().replace(" ", "-")}`}
                className={`relative h-16 flex items-center px-4 text-sm font-medium transition-colors ${active ? "text-white" : "text-zinc-400 hover:text-white"}`}>
                {l.label}
                {active && <span className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-[#CCFF00]" />}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {isAuthed ? (
            <DropdownMenu>
              <DropdownMenuTrigger data-testid="account-menu" className="flex items-center gap-2 h-10 rounded-full border border-white/15 pl-1 pr-3 hover:border-white/30 hover:bg-white/[0.06] transition-colors">
                <AvatarCircle className="w-8 h-8 text-sm" />
                <span className="text-sm font-semibold hidden sm:block">{user?.name?.split(" ")[0] || "Account"}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1A1A1A] border-white/10 text-white w-64">
                <DropdownMenuLabel className="flex items-center gap-3 p-3">
                  <AvatarCircle className="w-11 h-11 text-lg" />
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <span className="text-sm font-semibold truncate">{user?.name}</span>
                    <span className="text-xs text-zinc-500 font-normal truncate">{user?.email}</span>
                    {onboarded && <span className="text-[10px] text-[#CCFF00] font-bold uppercase tracking-wide">Viewing as {ROLE_NOUN[activeRole]}</span>}
                  </div>
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
              <Link to="/login" data-testid="nav-login" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors px-2">Log in</Link>
              <Link to="/register" data-testid="nav-register" className="btn-lime h-9 px-5 text-sm hidden sm:flex">Sign up</Link>
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
          {!isAuthed && (
            <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-2">
              <Link to="/login" data-testid="mobile-nav-login" onClick={() => setOpen(false)} className="btn-ghost h-10 justify-center text-sm">Log in</Link>
              <Link to="/register" data-testid="mobile-nav-register" onClick={() => setOpen(false)} className="btn-lime h-10 justify-center text-sm">Sign up</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
