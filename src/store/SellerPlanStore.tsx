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
import { db, isSupabaseConfigured } from "../lib/supabase";
import {
  ensureOwnProfile,
  isRepairFunctionMissing,
  PROFILE_MIGRATION_MESSAGE,
  PROFILE_MISSING_MESSAGE,
  readOwnProfile,
} from "../lib/sellerProfile";
import { useAuth } from "./AuthStore";
import { readJSON, writeJSON } from "../lib/storage";
import {
  computeSellerPlan,
  type SellerPlan,
  type SellerPlanSource,
} from "../lib/sellerPlan";

/**
 * Seller ka free-period / plan status.
 *
 * Yeh MOJOODA `public.profiles` row hi padhta hai (wahi table jo AuthStore
 * is_admin ke liye use karta hai) — koi naya user ya auth system nahi banaya
 * gaya. Local dev mode (Supabase configured nahi) mein start date browser
 * mein save hoti hai taake forms test kiye ja sakein.
 */

const LOCAL_PLAN_KEY = "bazaario_seller_plan_v1";

interface LocalPlanRecord {
  createdAt: string;
  termsAcceptedAt: string | null;
}

type LocalPlanMap = Record<string, LocalPlanRecord>;

interface SellerPlanValue {
  plan: SellerPlan;
  loading: boolean;
  error: string | null;
  /** Seller terms accept karke profile par record kar dein. */
  acceptTerms: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SellerPlanContext = createContext<SellerPlanValue | null>(null);

export function SellerPlanProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const [source, setSource] = useState<SellerPlanSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the newest refresh may write state: a slow response for a previous
  // user/token must not overwrite the current one.
  const requestId = useRef(0);

  const loadLocal = useCallback((userId: string): SellerPlanSource => {
    const map = readJSON<LocalPlanMap>(LOCAL_PLAN_KEY, {});
    let record = map[userId];
    if (!record) {
      record = { createdAt: new Date().toISOString(), termsAcceptedAt: null };
      writeJSON(LOCAL_PLAN_KEY, { ...map, [userId]: record });
    }
    return {
      createdAt: record.createdAt,
      planStatus: "free",
      termsAcceptedAt: record.termsAcceptedAt,
    };
  }, []);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    const isCurrent = () => id === requestId.current;

    if (!user) {
      setSource(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setSource(loadLocal(user.id));
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = accessToken ?? undefined;
      let row = await readOwnProfile(user.id, token);

      if (!row && token) {
        // No profiles row for this account (it predates the signup trigger, or the
        // trigger failed). Ask the database to create it from the verified token —
        // see supabase/seller-profile-fix.sql. Never fabricated on the client.
        try {
          row = await ensureOwnProfile(token);
        } catch (err) {
          if (!isCurrent()) return;
          console.error("Seller profile repair failed:", err);
          setSource(null);
          setError(isRepairFunctionMissing(err) ? PROFILE_MIGRATION_MESSAGE : PROFILE_MISSING_MESSAGE);
          return;
        }
      }

      if (!isCurrent()) return;
      if (!row) {
        setSource(null);
        setError(PROFILE_MISSING_MESSAGE);
      } else {
        setSource({
          createdAt: (row.created_at as string) ?? null,
          freeStart: (row.seller_free_start as string) ?? null,
          planStatus: (row.seller_plan_status as string) ?? null,
          paidUntil: (row.seller_plan_paid_until as string) ?? null,
          termsAcceptedAt: (row.seller_terms_accepted_at as string) ?? null,
        });
        setError(null);
      }
    } catch (err) {
      if (!isCurrent()) return;
      console.error("Seller plan load failed:", err);
      setSource(null);
      setError("Couldn't check your seller plan status. Please try again.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [user, accessToken, loadLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const acceptTerms = useCallback(async () => {
    if (!user) return;
    const acceptedAt = new Date().toISOString();

    if (!isSupabaseConfigured) {
      const map = readJSON<LocalPlanMap>(LOCAL_PLAN_KEY, {});
      const record = map[user.id] ?? { createdAt: acceptedAt, termsAcceptedAt: null };
      writeJSON(LOCAL_PLAN_KEY, {
        ...map,
        [user.id]: { ...record, termsAcceptedAt: acceptedAt },
      });
      setSource((s) => ({ ...(s ?? {}), termsAcceptedAt: acceptedAt }));
      return;
    }

    try {
      // Security-definer RPC — seller sirf yehi ek column set kar sakta hai.
      await db.insert("rpc/accept_seller_terms", {}, accessToken ?? undefined);
    } catch (err) {
      // Agar migration abhi nahi chali to publishing na rukay — seller ne
      // checkbox par agree kiya hai, sirf DB record isi session mein nahi bani.
      console.warn("Could not record seller terms acceptance:", err);
    }
    setSource((s) => ({ ...(s ?? {}), termsAcceptedAt: acceptedAt }));
  }, [user, accessToken]);

  const plan = useMemo(() => computeSellerPlan(source), [source]);

  const value = useMemo<SellerPlanValue>(
    () => ({ plan, loading, error, acceptTerms, refresh }),
    [plan, loading, error, acceptTerms, refresh]
  );

  return <SellerPlanContext.Provider value={value}>{children}</SellerPlanContext.Provider>;
}

export function useSellerPlan() {
  const ctx = useContext(SellerPlanContext);
  if (!ctx) throw new Error("useSellerPlan must be used within SellerPlanProvider");
  return ctx;
}
