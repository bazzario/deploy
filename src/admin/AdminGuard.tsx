import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthStore";

/**
 * Gate for every /admin/* page except /admin/login.
 *
 * Access requires a Supabase session whose profiles row has is_admin = true
 * (AuthStore derives `user.isAdmin` from it). Blocked accounts (is_blocked)
 * never receive a session at all — AuthStore refuses them at sign-in and when
 * a saved session is restored — so they cannot get past this guard either.
 *
 * Anyone else is redirected to /admin/login. A regular shopper who wanders
 * onto an admin URL is redirected but NOT signed out of their shop account.
 */
export default function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
        <div className="text-sm text-ink-soft">Checking admin access…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (!user.isAdmin) {
    return <Navigate to="/admin/login" replace state={{ denied: true }} />;
  }

  return <>{children}</>;
}
