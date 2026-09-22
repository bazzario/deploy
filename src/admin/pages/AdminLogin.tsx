import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail, KeyRound, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "../../store/AuthStore";
import { LogoFull } from "../../components/Logo";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, backendConnected, signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Already signed in as an admin: go straight to the dashboard.
  if (!authLoading && user?.isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      // Supabase Auth email/password sign-in. `requireAdmin` makes AuthStore
      // check profiles.is_admin and refuse (and sign out) any non-admin account;
      // blocked accounts (profiles.is_blocked) are always refused.
      await signIn(email, password, { requireAdmin: true });
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("Enter your admin email first.");
      return;
    }
    setBusy(true);
    try {
      setMessage(await resetPassword(email));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the reset email.");
    } finally {
      setBusy(false);
    }
  }

  const denied = Boolean((location.state as { denied?: boolean } | null)?.denied);

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <LogoFull variant="light" className="h-24 mx-auto" />
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mt-1">Admin Console</p>
        </div>

        <div className="card-base p-6 sm:p-7">
          <div className="w-11 h-11 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mx-auto">
            <Lock size={20} />
          </div>
          <h1 className="font-display font-bold text-lg text-ink mt-3 text-center">Sign in to admin</h1>
          <p className="text-xs text-ink-soft mt-1 text-center">Restricted area. Authorized administrators only.</p>

          {!backendConnected && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 mt-4 text-[11px] text-red-800">
              Supabase is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.
            </div>
          )}

          {denied && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-4 text-[11px] text-amber-800">
              Admin access is required for this area.
            </div>
          )}

          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 mt-4 text-[11px] text-red-800">{error}</div>}
          {message && <div className="rounded-lg bg-green-50 border border-green-200 p-3 mt-4 text-[11px] text-green-800">{message}</div>}

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <div>
              <label className="text-xs font-semibold text-ink-soft mb-1 block">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@bazaario.pk" className="input-base !pl-9" autoComplete="username" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-soft mb-1 block">Password</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input-base !pl-9 !pr-9" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end text-xs pt-1">
              <button type="button" onClick={handleForgotPassword} disabled={busy} className="text-brand-600 font-semibold hover:text-brand-700 disabled:opacity-50">
                Forgot password?
              </button>
            </div>

            <button type="submit" disabled={busy || !backendConnected} className="btn-primary w-full !mt-5 disabled:opacity-60">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3 mt-5">
            <ShieldCheck size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-green-800 leading-relaxed">
              Admin access is verified through Supabase Auth and <strong>profiles.is_admin</strong>. No admin password is stored in the frontend.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
