import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";

const ROLE_HOME = { customer: "/customer", clipper: "/clipper", admin: "/admin" };

// Gates a route behind authentication and (optionally) a set of allowed roles.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useApp();
  const loc = useLocation();

  const wrongRole = !!user && roles && !roles.includes(user.role);
  useEffect(() => {
    if (wrongRole) {
      toast.error(roles.includes("clipper")
        ? "Bidding is for clippers — sign up or switch to a clipper account to bid."
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
  if (wrongRole) {
    // Logged in but wrong role — keep them in the app on THEIR dashboard,
    // never show a login form to an already-authenticated user.
    return <Navigate to={ROLE_HOME[user.role] || "/"} replace />;
  }
  return children;
}
