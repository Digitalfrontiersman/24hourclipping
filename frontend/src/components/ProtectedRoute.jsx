import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { ROLE_HOME } from "@/lib/roles";

// Gates a route behind authentication and (optionally) a set of allowed
// capabilities. `skipOnboarding` is for the onboarding route itself.
export default function ProtectedRoute({ roles, skipOnboarding = false, children }) {
  const { user, loading } = useApp();
  const loc = useLocation();

  const held = user?.roles || [];
  const isAdmin = held.includes("admin");
  // Capability-based: the account must HOLD one of the allowed roles (or be
  // admin). Active dashboard mode no longer gates access.
  const wrongRole = !!user && roles && !isAdmin && !roles.some((r) => held.includes(r));

  useEffect(() => {
    if (wrongRole) {
      toast.error(roles.includes("clipper")
        ? "Bidding is for clippers — add a clipper profile to bid."
        : "That area isn't available for your account type.");
    }
  }, [wrongRole, roles]);

  if (loading) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }
  if (!user) {
    // Genuinely logged out — go sign in, then return where they were headed.
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  }
  if (!skipOnboarding && !user.onboarded) {
    // Signed up but hasn't finished the wizard — send them through it first.
    return <Navigate to="/onboarding" replace />;
  }
  if (wrongRole) {
    // Logged in but lacks this capability — keep them on THEIR dashboard.
    return <Navigate to={ROLE_HOME[user.role] || "/"} replace />;
  }
  return children;
}
