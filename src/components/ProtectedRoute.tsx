import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import Spinner from "./Spinner";

export function ProtectedRoute() {
  const { user, initializing } = useAuthStore();
  const location = useLocation();

  if (initializing) return <Spinner label="Loading your session…" />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}

export function AdminRoute() {
  const { user, profile, isAdmin, initializing } = useAuthStore();

  // Wait for the profile too — role is unknown until it loads.
  if (initializing || (user && !profile)) {
    return <Spinner label="Loading your session…" />;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
