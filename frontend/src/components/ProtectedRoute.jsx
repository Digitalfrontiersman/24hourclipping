import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";

// Gates a route behind authentication and (optionally) a set of allowed roles.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useApp();
  const loc = useLocation();

  const wrongRole = !!user && roles && !roles.includes(user.role);
  useEffect(() => {
    if (wrongRole) {
      toast.error(roles.includes("clipper")
        ? "Bidding is for clippers — sign in with a clipper account to continue."
        : "You don't have access to that area with this account.");
    }
  }, [wrongRole, roles]);

  if (loading) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  }
  if (wrongRole) {
    // Send them to login (to switch accounts) rather than silently to the homepage.
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  }
  return children;
}
