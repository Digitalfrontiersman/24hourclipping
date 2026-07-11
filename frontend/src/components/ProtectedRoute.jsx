import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";

// Gates a route behind authentication and (optionally) a set of allowed roles.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useApp();
  const loc = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
