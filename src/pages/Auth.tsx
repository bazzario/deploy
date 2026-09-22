import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../store/AuthStore";
import { LogoFull } from "../components/Logo";

type Mode = "login" | "signup" | "forgot";

export default function Auth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, signIn, signUp, signOut, resetPassword, backendConnected } = useAuth();

  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const redirectTo = params.get("next") || "/";

  if (user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm card-base p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mx-auto">
            <UserIcon size={22} />
          </div>
          <h1 className="font-display font-bold text-lg text-ink mt-3">
            Welcome, {user.name}
          </h1>
          {user.email && <p className="text-sm text-ink-soft mt-1">{user.email}</p>}
          <Link to="/orders" className="btn-primary w-full mt-5">Your orders</Link>
          <button
            onClick={() => void signOut()}
            className="btn-secondary w-full mt-3"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  function resetMessages() {
    setError("");
    setNotice("");
  }

  function switchMode(next: Mode) {
    setMode(next);
    resetMessages();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    resetMessages();
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp(name, email, password);
        navigate(redirectTo, { replace: true });
      } else if (mode === "login") {
        await signIn(email, password);
        navigate(redirectTo, { replace: true });
      } else {
        setNotice(await resetPassword(email));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-sm sm:max-w-md card-base p-5 sm:p-7">
        <Link to="/" className="flex justify-center mb-5">
          <LogoFull className="h-16 sm:h-20" />
        </Link>

        {!backendConnected && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 mb-5">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Development mode: accounts are only saved in this browser. Set the Supabase
              environment variables before launching (see README).
            </p>
          </div>
        )}

        {mode !== "forgot" && (
          <div className="flex rounded-full bg-surface-alt p-1 mb-5">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 text-sm font-semibold py-2 rounded-full transition-colors ${
                mode === "login" ? "bg-white shadow-card text-ink" : "text-ink-soft"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`flex-1 text-sm font-semibold py-2 rounded-full transition-colors ${
                mode === "signup" ? "bg-white shadow-card text-ink" : "text-ink-soft"
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        <h1 className="font-display font-bold text-lg sm:text-xl text-ink text-center">
          {mode === "login" && "Welcome back"}
          {mode === "signup" && "Create your account"}
          {mode === "forgot" && "Reset your password"}
        </h1>
        <p className="text-xs sm:text-sm text-ink-soft mt-1 text-center px-2">
          {mode === "login" && "Sign in to continue to Bazaario"}
          {mode === "signup" && "Join Pakistan's marketplace for everything"}
          {mode === "forgot" && "Enter your email and we'll send you a reset link"}
        </p>

        <form className="mt-6 flex flex-col gap-3.5 w-full" onSubmit={submit}>
          {mode === "signup" && (
            <label className="block w-full">
              <span className="text-xs font-medium text-ink-soft mb-1 block">Full name</span>
              <div className="relative w-full">
                <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ali Khan"
                  autoComplete="name"
                  required
                  className="input-base !pl-10"
                />
              </div>
            </label>
          )}

          <label className="block w-full">
            <span className="text-xs font-medium text-ink-soft mb-1 block">Email address</span>
            <div className="relative w-full">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="username"
                required
                className="input-base !pl-10"
              />
            </div>
          </label>

          {mode !== "forgot" && (
            <label className="block w-full">
              <span className="text-xs font-medium text-ink-soft mb-1 block">Password</span>
              <div className="relative w-full">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  className="input-base !pl-10 !pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {mode === "signup" && (
                <span className="text-[11px] text-ink-soft mt-1 block">
                  At least 8 characters, with one letter and one number.
                </span>
              )}
            </label>
          )}

          {mode === "login" && (
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {notice && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              {notice}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full mt-1.5 !py-3">
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign In"
                : mode === "signup"
                  ? "Create Account"
                  : "Send reset link"}
          </button>

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="text-xs font-medium text-ink-soft hover:text-brand-600"
            >
              Back to sign in
            </button>
          )}
        </form>

        <p className="text-xs text-ink-soft text-center mt-5">
          By continuing you agree to Bazaario's{" "}
          <Link to="/terms" className="text-brand-600 font-medium">Terms</Link> &amp;{" "}
          <Link to="/privacy" className="text-brand-600 font-medium">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
