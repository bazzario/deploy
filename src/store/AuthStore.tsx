import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { auth as sbAuth, db, isSupabaseConfigured, SessionError, SupabaseError } from "../lib/supabase";
import { readJSON, removeKey, writeJSON } from "../lib/storage";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

interface Session {
  user: AuthUser;
  accessToken: string | null;
  refreshToken: string | null;
}

/** A session the Auth server has just confirmed. `userId` comes from the server, not from local state. */
export interface VerifiedSession {
  accessToken: string;
  userId: string;
}

interface AuthValue {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  /** true = asli backend chal raha hai; false = sirf local dev mode. */
  backendConnected: boolean;
  /**
   * Email + password sign-in. Blocked accounts (profiles.is_blocked) are always
   * refused. With `requireAdmin`, a non-admin account is refused too and NO
   * session is kept — used by /admin/login.
   */
  signIn: (
    email: string,
    password: string,
    options?: { requireAdmin?: boolean }
  ) => Promise<AuthUser>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string>;
  /**
   * Confirms with the Auth server that the current session is valid and returns a
   * usable token + the verified user id. If the access token has expired it is
   * refreshed first (using the existing refresh-token flow). Throws SessionError —
   * without touching any protected API — when there is no session, it cannot be
   * renewed, or the check itself could not reach the server. Use it right before
   * actions that must not run on a stale token (e.g. Storage uploads).
   */
  ensureSession: (options?: { force?: boolean }) => Promise<VerifiedSession>;
}

const SESSION_KEY = "bazaario_session_v1";
const LOCAL_USERS_KEY = "bazaario_local_users_v1";
/** Refresh the access token every 40 min (Supabase's default lifetime is 60). */
const TOKEN_REFRESH_MS = 40 * 60 * 1000;
/** After a tab wakes up, refresh right away if the token is older than this. */
const TOKEN_STALE_MS = 30 * 60 * 1000;
/** A token the server confirmed is trusted for this long before it is checked again. */
const VERIFY_TTL_MS = 30 * 1000;

const env = import.meta.env as Record<string, string | undefined>;
/** Local dev mode mein sirf yeh email admin ban sakta hai. */
const DEV_ADMIN_EMAIL = (env.VITE_DEV_ADMIN_EMAIL ?? "").trim().toLowerCase();

const AuthContext = createContext<AuthValue | null>(null);

/* ----------------------------- helpers ----------------------------- */

export class AuthError extends Error {}

const BLOCKED_MESSAGE =
  "This account has been blocked. Please contact support if you think this is a mistake.";
const NOT_ADMIN_MESSAGE = "This account does not have admin access.";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePassword(password: string) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))
    return "Password must include at least one letter and one number.";
  return null;
}

async function hash(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* -------------------------- local dev backend -------------------------- */
/* Yeh SIRF development ke liye hai. Accounts is browser ke localStorage mein
   rehte hain — na secure hai, na dusre device par kaam karega. Production
   mein Supabase env variables set karein. */

interface LocalUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

function loadLocalUsers(): LocalUser[] {
  return readJSON<LocalUser[]>(LOCAL_USERS_KEY, []);
}

async function localSignUp(name: string, email: string, password: string): Promise<Session> {
  const users = loadLocalUsers();
  if (users.some((u) => u.email === email)) {
    throw new AuthError("An account with this email already exists. Please sign in.");
  }
  const user: LocalUser = {
    id: `u-${Date.now()}`,
    name,
    email,
    passwordHash: await hash(password),
  };
  writeJSON(LOCAL_USERS_KEY, [...users, user]);
  return {
    user: { id: user.id, name, email, isAdmin: isDevAdmin(email) },
    accessToken: null,
    refreshToken: null,
  };
}

async function localSignIn(email: string, password: string): Promise<Session> {
  const users = loadLocalUsers();
  const found = users.find((u) => u.email === email);
  const passwordHash = await hash(password);
  if (!found || found.passwordHash !== passwordHash) {
    throw new AuthError("Incorrect email or password.");
  }
  return {
    user: {
      id: found.id,
      name: found.name,
      email,
      isAdmin: isDevAdmin(email),
    },
    accessToken: null,
    refreshToken: null,
  };
}

function isDevAdmin(email: string) {
  return Boolean(DEV_ADMIN_EMAIL) && email === DEV_ADMIN_EMAIL;
}

/* --------------------------- supabase backend --------------------------- */

interface SupabaseAuthResponse {
  access_token?: string;
  refresh_token?: string;
  user?: {
    id?: string;
    email?: string;
    user_metadata?: { full_name?: string };
  };
  id?: string;
  email?: string;
  user_metadata?: { full_name?: string };
}

interface ProfileRow {
  is_admin?: boolean | null;
  is_blocked?: boolean | null;
}

interface ProfileFlags {
  isAdmin: boolean;
  isBlocked: boolean;
}

function flagsFromRow(row: ProfileRow | undefined): ProfileFlags {
  return { isAdmin: row?.is_admin === true, isBlocked: row?.is_blocked === true };
}

/**
 * Reads the signed-in user's own profiles row (allowed by the "read own row"
 * RLS policy). Admin access is fail-CLOSED: unless the row is read successfully
 * and says is_admin = true, the user is not an admin.
 */
async function fetchProfileFlags(userId: string, accessToken: string): Promise<ProfileFlags> {
  const id = encodeURIComponent(userId);
  try {
    const rows = await db.select<ProfileRow[]>(
      "profiles",
      `select=is_admin,is_blocked&id=eq.${id}`,
      accessToken
    );
    return flagsFromRow(rows?.[0]);
  } catch (err) {
    // 400 = the is_blocked column doesn't exist yet (supabase/admin-setup.sql not
    // run). Fall back to is_admin only so existing admin accounts keep working.
    if (err instanceof SupabaseError && err.status === 400) {
      try {
        const rows = await db.select<ProfileRow[]>(
          "profiles",
          `select=is_admin&id=eq.${id}`,
          accessToken
        );
        return flagsFromRow(rows?.[0]);
      } catch {
        // fall through
      }
    }
    // profiles table missing / policy denies / network error => not an admin.
    return { isAdmin: false, isBlocked: false };
  }
}

/** Best-effort server-side logout of a token we decided not to keep. */
async function revokeSession(accessToken: string | null) {
  if (!accessToken) return;
  try {
    await sbAuth.signOut(accessToken);
  } catch {
    // token already expired — nothing left to revoke
  }
}

async function toSession(res: SupabaseAuthResponse, fallbackName: string): Promise<Session> {
  const rawUser = res.user ?? res;
  const id = rawUser.id ?? "";
  const accessToken = res.access_token ?? null;
  const email = rawUser.email ?? "";
  const name =
    rawUser.user_metadata?.full_name ||
    fallbackName ||
    (email ? email.split("@")[0] : "");
  const { isAdmin, isBlocked } =
    id && accessToken
      ? await fetchProfileFlags(id, accessToken)
      : { isAdmin: false, isBlocked: false };

  // Blocked accounts never get a session — whether they signed in with email
  // or a saved session is being restored on page load.
  if (isBlocked) {
    await revokeSession(accessToken);
    throw new AuthError(BLOCKED_MESSAGE);
  }

  return {
    user: { id, name, email, isAdmin },
    accessToken,
    refreshToken: res.refresh_token ?? null,
  };
}

async function supabaseSignIn(email: string, password: string): Promise<Session> {
  try {
    const res = (await sbAuth.signIn({ email, password })) as SupabaseAuthResponse;
    return await toSession(res, "");
  } catch (err) {
    throw asAuthError(err);
  }
}

/* ------------------------------ provider ------------------------------ */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Startup par saved session restore karein.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const saved = readJSON<Session | null>(SESSION_KEY, null);
      if (!saved) {
        setLoading(false);
        return;
      }

      if (isSupabaseConfigured && saved.refreshToken) {
        try {
          const res = (await sbAuth.refresh(saved.refreshToken)) as SupabaseAuthResponse;
          const next = await toSession(res, saved.user.name);
          if (!cancelled) {
            setSession(next);
            writeJSON(SESSION_KEY, next);
          }
        } catch {
          if (!cancelled) {
            removeKey(SESSION_KEY);
            setSession(null);
          }
        }
      } else if (!isSupabaseConfigured) {
        if (!cancelled) setSession(saved);
      }

      if (!cancelled) setLoading(false);
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // Always holds the newest session, updated synchronously (state updates are async),
  // so code that runs right after a refresh never reads the old, expired token.
  const sessionRef = useRef<Session | null>(null);

  const persist = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
    if (next) writeJSON(SESSION_KEY, next);
    else removeKey(SESSION_KEY);
  }, []);

  // Supabase access tokens expire (1 hour by default) and were previously only
  // refreshed on page load. A long-lived admin tab would then get 401s on every
  // button. Swap in a fresh token in the background; the user object (and its
  // is_admin flag) is left untouched so a transient error can't demote anyone.
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const refreshToken = session?.refreshToken ?? null;
  useEffect(() => {
    if (!isSupabaseConfigured || !refreshToken) return;
    let cancelled = false;
    let busy = false;
    let lastRefreshAt = Date.now();

    async function refreshTokens() {
      const current = sessionRef.current;
      if (busy || cancelled || !current?.refreshToken) return;
      busy = true;
      try {
        const res = (await sbAuth.refresh(current.refreshToken)) as SupabaseAuthResponse;
        if (cancelled || !res.access_token) return;
        lastRefreshAt = Date.now();
        persist({
          ...current,
          accessToken: res.access_token,
          refreshToken: res.refresh_token ?? current.refreshToken,
        });
      } catch {
        // Keep the current session; the next tick (or page load) will retry.
      } finally {
        busy = false;
      }
    }

    const timer = window.setInterval(() => void refreshTokens(), TOKEN_REFRESH_MS);
    // Timers are throttled while a tab sleeps, so also refresh when it wakes up.
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshAt > TOKEN_STALE_MS) {
        void refreshTokens();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshToken, persist]);

  const verifiedRef = useRef<{ token: string; at: number; userId: string } | null>(null);
  const ensureInflight = useRef<Promise<VerifiedSession> | null>(null);

  const ensureSession = useCallback(
    (options?: { force?: boolean }): Promise<VerifiedSession> => {
      // Concurrent callers (several images uploading at once) share one check/refresh,
      // so a rotating refresh token is never spent twice.
      if (ensureInflight.current && !options?.force) return ensureInflight.current;

      const run = async (): Promise<VerifiedSession> => {
        if (!isSupabaseConfigured) {
          throw new SessionError("unavailable", "The backend isn't connected, so this action isn't available.");
        }
        const current = sessionRef.current;
        if (!current?.accessToken) {
          throw new SessionError("no-session", "You're not signed in. Please sign in and try again.");
        }

        const cached = verifiedRef.current;
        if (!options?.force && cached && cached.token === current.accessToken && Date.now() - cached.at < VERIFY_TTL_MS) {
          return { accessToken: cached.token, userId: cached.userId };
        }

        // 1. Ask the Auth server whether this token is still good.
        let needsRefresh = false;
        try {
          const who = await sbAuth.getUser(current.accessToken);
          if (who.id && who.id === current.user.id) {
            verifiedRef.current = { token: current.accessToken, at: Date.now(), userId: who.id };
            return { accessToken: current.accessToken, userId: who.id };
          }
          needsRefresh = true; // token belongs to someone else / no id: don't trust it
        } catch (err) {
          if (err instanceof SupabaseError && (err.status === 401 || err.status === 403)) needsRefresh = true;
          else if (err instanceof SupabaseError && err.status > 0) {
            throw new SessionError("network", `Couldn't verify your session (${err.message}). Please retry.`);
          } else {
            throw new SessionError("network", "Couldn't verify your session. Check your connection and retry.");
          }
        }

        // 2. Expired: recover with the refresh token — the same flow used at startup.
        if (needsRefresh) {
          const expired = () => new SessionError("expired", "Your session has expired. Please sign in again.");
          if (!current.refreshToken) {
            persist(null);
            throw expired();
          }
          let res: SupabaseAuthResponse;
          try {
            res = (await sbAuth.refresh(current.refreshToken)) as SupabaseAuthResponse;
          } catch (err) {
            if (err instanceof SupabaseError && err.status >= 400 && err.status < 500) {
              persist(null); // refresh token rejected: the session really is over
              throw expired();
            }
            throw new SessionError("network", "Couldn't renew your session. Check your connection and retry.");
          }
          if (!res.access_token) {
            persist(null);
            throw expired();
          }
          const next: Session = {
            ...current,
            accessToken: res.access_token,
            refreshToken: res.refresh_token ?? current.refreshToken,
          };
          persist(next);
          try {
            const who = await sbAuth.getUser(next.accessToken as string);
            if (!who.id || who.id !== current.user.id) throw expired();
            verifiedRef.current = { token: next.accessToken as string, at: Date.now(), userId: who.id };
            return { accessToken: next.accessToken as string, userId: who.id };
          } catch (err) {
            if (err instanceof SessionError) throw err;
            throw new SessionError("network", "Couldn't verify your renewed session. Please retry.");
          }
        }
        throw new SessionError("no-session", "You're not signed in. Please sign in and try again.");
      };

      const promise = run().finally(() => {
        if (ensureInflight.current === promise) ensureInflight.current = null;
      });
      ensureInflight.current = promise;
      return promise;
    },
    [persist]
  );

  const signUp = useCallback(
    async (name: string, rawEmail: string, password: string) => {
      const email = normalizeEmail(rawEmail);
      const trimmedName = name.trim();
      if (trimmedName.length < 2) throw new AuthError("Please enter your full name.");
      if (!validateEmail(email)) throw new AuthError("Please enter a valid email address.");
      const pwError = validatePassword(password);
      if (pwError) throw new AuthError(pwError);

      if (!isSupabaseConfigured) {
        persist(await localSignUp(trimmedName, email, password));
        return;
      }

      try {
        const res = (await sbAuth.signUp({
          email,
          password,
          data: { full_name: trimmedName },
        })) as SupabaseAuthResponse;

        if (!res.access_token) {
          // Email confirmation is enabled — the user needs to verify first.
          throw new AuthError(
            "Account created. Please open the confirmation link in your email, then sign in."
          );
        }
        persist(await toSession(res, trimmedName));
      } catch (err) {
        throw asAuthError(err);
      }
    },
    [persist]
  );

  const signIn = useCallback(
    async (rawEmail: string, password: string, options?: { requireAdmin?: boolean }) => {
      const email = normalizeEmail(rawEmail);
      if (!validateEmail(email)) throw new AuthError("Please enter a valid email address.");
      if (!password) throw new AuthError("Please enter your password.");

      const next = isSupabaseConfigured
        ? await supabaseSignIn(email, password)
        : await localSignIn(email, password);

      if (options?.requireAdmin && !next.user.isAdmin) {
        // Admin form + a non-admin account: don't leave a session behind.
        await revokeSession(next.accessToken);
        throw new AuthError(NOT_ADMIN_MESSAGE);
      }

      persist(next);
      return next.user;
    },
    [persist]
  );

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && session?.accessToken) {
      try {
        await sbAuth.signOut(session.accessToken);
      } catch {
        // token pehle hi expire ho chuka — local session clear kar dena kaafi hai
      }
    }
    persist(null);
  }, [persist, session]);

  const resetPassword = useCallback(async (rawEmail: string) => {
    const email = normalizeEmail(rawEmail);
    if (!validateEmail(email)) throw new AuthError("Please enter a valid email address.");

    if (!isSupabaseConfigured) {
      throw new AuthError(
        "Password reset requires the backend to be connected (set the Supabase environment variables)."
      );
    }

    try {
      await sbAuth.recover(email);
      return "If this email is registered, a reset link has been sent.";
    } catch (err) {
      throw asAuthError(err);
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      loading,
      backendConnected: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      resetPassword,
      ensureSession,
    }),
    [session, loading, signIn, signUp, signOut, resetPassword, ensureSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function asAuthError(err: unknown) {
  if (err instanceof AuthError) return err;
  if (err instanceof SupabaseError) {
    if (err.status === 400) return new AuthError("Incorrect email or password.");
    if (err.status === 422) return new AuthError("This email is already registered.");
    if (err.status === 429) return new AuthError("Too many attempts. Please try again in a bit.");
    return new AuthError(err.message);
  }
  return new AuthError("Connection issue. Check your internet and try again.");
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
