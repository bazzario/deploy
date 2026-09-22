import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePersistentState } from "../lib/storage";

interface AppStoreValue {
  wishlistIds: string[];
  toggleWishlist: (id: string) => void;
  isWishlisted: (id: string) => boolean;
}

const WISHLIST_KEY = "bazaario_wishlist_v1";

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  // Wishlist localStorage mein persist hoti hai — refresh par reset nahi hoti.
  const [wishlistIds, setWishlistIds] = usePersistentState<string[]>(WISHLIST_KEY, []);

  const value = useMemo<AppStoreValue>(
    () => ({
      wishlistIds,
      toggleWishlist: (id) =>
        setWishlistIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        ),
      isWishlisted: (id) => wishlistIds.includes(id),
    }),
    [wishlistIds, setWishlistIds]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
