import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../store/AuthStore";
import { useListings } from "../store/ListingsStore";
import { isSupabaseConfigured } from "../lib/supabase";
import { fetchMyListings, NO_LISTINGS, type MyListingsResult } from "../lib/sellerListings";

export interface MyListings extends MyListingsResult {
  /** True until the first result for the signed-in seller has arrived. */
  loading: boolean;
  /** Re-read the seller's listings (e.g. after deleting one). */
  reload: () => void;
}

/**
 * The signed-in seller's own listings for the Seller Dashboard.
 *
 * With a backend they are queried by `owner_id = <me>` (lib/sellerListings.ts).
 * In local development mode (no Supabase) there is no server to ask, so the
 * browser-only store is filtered by owner instead — the same as before.
 */
export function useMyListings(): MyListings {
  const { user, accessToken } = useAuth();
  const catalog = useListings();
  const sellerId = user?.id ?? null;

  // The token rotates every ~40 min; that must not restart the query.
  const tokenRef = useRef<string | undefined>(accessToken ?? undefined);
  useEffect(() => {
    tokenRef.current = accessToken ?? undefined;
  }, [accessToken]);

  const [remote, setRemote] = useState<{ sellerId: string; result: MyListingsResult } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured || !sellerId) return;
    let cancelled = false;
    void fetchMyListings(sellerId, tokenRef.current).then((result) => {
      if (!cancelled) setRemote({ sellerId, result });
    });
    return () => {
      cancelled = true;
    };
  }, [sellerId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  if (!isSupabaseConfigured) {
    return {
      products: catalog.products.filter((p) => p.ownerId === sellerId),
      usedItems: catalog.usedItems.filter((u) => u.ownerId === sellerId),
      automobiles: catalog.automobiles.filter((a) => a.ownerId === sellerId),
      failed: NO_LISTINGS.failed,
      loading: false,
      reload,
    };
  }

  // Never show another account's data: only a result fetched for THIS seller counts.
  if (!sellerId || remote?.sellerId !== sellerId) {
    return { ...NO_LISTINGS, loading: Boolean(sellerId), reload };
  }
  return { ...remote.result, loading: false, reload };
}
