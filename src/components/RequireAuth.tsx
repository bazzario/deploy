import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "../store/AuthStore";

/**
 * Seller-only pages ke liye auth gate — Admin.tsx ke AdminGate jaisa hi pattern.
 * Login nahi hai to sign-in card dikhata hai (aur wapas isi page par le aata hai),
 * login hai to seedha content render karta hai. Admin permission yahan zaroori
 * nahi — koi bhi signed-in user apni listings manage kar sakta hai.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-sm text-ink-soft">Checking your account…</p>
      </div>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xs card-base p-6 text-center">
          <div className="w-11 h-11 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mx-auto">
            <Lock size={20} />
          </div>
          <h1 className="font-display font-bold text-lg text-ink mt-3">Sign in to continue</h1>
          <p className="text-xs text-ink-soft mt-1">
            Please sign in to your account before posting a listing.
          </p>
          <Link
            to={`/auth?mode=login&next=${encodeURIComponent(next)}`}
            className="btn-primary w-full mt-4"
          >
            Sign in
          </Link>
          <p className="text-xs text-ink-soft mt-3">
            Don't have an account?{" "}
            <Link
              to={`/auth?mode=signup&next=${encodeURIComponent(next)}`}
              className="text-brand-600 font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
