import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product, UsedItem, Automobile } from "../data/types";
import { products as seedProducts } from "../data/products";
import { usedItems as seedUsedItems } from "../data/usedItems";
import { automobiles as seedAutomobiles } from "../data/automobiles";
import { db, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "./AuthStore";
import { readJSON, writeJSON } from "../lib/storage";
import { deleteProductFolder, getProductImages } from "../lib/productImages";
import { autoFromRow, productFromRow, usedFromRow, type Row } from "../lib/listingRows";

const STORAGE_KEY = "bazaario_listings_v1";

interface ListingsData {
  products: Product[];
  usedItems: UsedItem[];
  automobiles: Automobile[];
}

const seedData: ListingsData = {
  products: seedProducts,
  usedItems: seedUsedItems,
  automobiles: seedAutomobiles,
};

function loadLocal(): ListingsData {
  const saved = readJSON<ListingsData | null>(STORAGE_KEY, null);
  if (saved && Array.isArray(saved.products)) return saved;
  return seedData;
}

/**
 * PostgREST reports success for an UPDATE/DELETE that Row Level Security (or a
 * wrong id) reduced to zero rows. Without this check the admin would see the
 * button "work" while nothing changed in the database.
 */
function assertChanged(rows: unknown, action: "update" | "delete") {
  if (Array.isArray(rows) && rows.length === 0) {
    throw new Error(
      `The database did not allow this ${action} (no row was changed). Make sure you are signed in as the listing's owner or an admin, and that supabase/seller-ownership.sql has been run.`
    );
  }
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/**
 * A product to create. `id` is optional: the Add Product form generates it up
 * front so photos can be uploaded to products/<id>/ before the row exists.
 */
export type NewProduct = Omit<Product, "id"> & { id?: string };

/**
 * True when PostgREST rejected a write because products.images doesn't exist,
 * i.e. supabase/product-images.sql hasn't been run on this project yet.
 */
function isMissingImagesColumn(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  return /['"]?images['"]?/i.test(message) && /column|schema cache/i.test(message);
}

const MIGRATION_HINT =
  "Saving more than one image needs a one-time database update. Run supabase/product-images.sql in the Supabase SQL editor, then try again.";

/**
 * Runs a products write with the full row. If the database hasn't been migrated
 * yet (no `images` column), a product with at most one image is still saved the
 * old way so publishing never breaks; only a multi-image save is refused, with
 * a message that says how to fix it.
 */
async function writeProductRow<T>(
  row: Row,
  write: (row: Row) => Promise<T>
): Promise<T> {
  try {
    return await write(row);
  } catch (err) {
    if (!isMissingImagesColumn(err)) throw err;
    const images = Array.isArray(row.images) ? row.images : [];
    if (images.length > 1) throw new Error(MIGRATION_HINT);
    const legacyRow = { ...row };
    delete legacyRow.images;
    return write(legacyRow);
  }
}

/* ------------------------- row <-> object mapping ------------------------- */

const productToRow = (p: Omit<Product, "id">): Row => {
  // Only real links go into `images` (the database enforces this). A legacy
  // `image` that isn't an http(s) URL is left as it was, in `image`.
  const images = getProductImages(p).filter((url) => /^https?:\/\//i.test(url));
  return {
    title: p.title,
    brand: p.brand,
    category: p.category,
    price: p.price,
    original_price: p.originalPrice ?? null,
    rating: p.rating,
    reviews: p.reviews,
    // `image` is always the primary image (images[0]); `images` holds them all.
    image: images[0] ?? p.image ?? "",
    images,
    badge: p.badge ?? null,
    free_delivery: !!p.freeDelivery,
    stock: p.stock ?? null,
    owner_id: p.ownerId ?? null,
  };
};

const usedToRow = (u: Omit<UsedItem, "id">): Row => ({
  title: u.title,
  price: u.price,
  negotiable: u.negotiable,
  condition: u.condition,
  location: u.location,
  seller: u.seller,
  seller_rating: u.sellerRating,
  posted_ago: u.postedAgo,
  image: u.image,
  category: u.category,
  description: u.description,
  phone: u.phone || null,
  verified: !!u.verified,
  owner_id: u.ownerId ?? null,
});

const autoToRow = (a: Omit<Automobile, "id">): Row => ({
  make: a.make,
  model: a.model,
  year: a.year,
  price: a.price,
  mileage_km: a.mileageKm,
  fuel: a.fuel,
  transmission: a.transmission,
  location: a.location,
  condition: a.condition,
  type: a.type,
  image: a.image,
  seller: a.seller,
  posted_ago: a.postedAgo,
  phone: a.phone || null,
  verified: !!a.verified,
  owner_id: a.ownerId ?? null,
});

/* -------------------------------- context -------------------------------- */

interface ListingsValue extends ListingsData {
  /** "supabase" = har visitor ko same data dikhega. "local" = sirf is browser mein. */
  source: "supabase" | "local";
  loading: boolean;
  error: string | null;

  addProduct: (p: NewProduct) => Promise<void>;
  updateProduct: (id: string, p: Omit<Product, "id">) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  addUsedItem: (u: Omit<UsedItem, "id">) => Promise<void>;
  updateUsedItem: (id: string, u: Omit<UsedItem, "id">) => Promise<void>;
  deleteUsedItem: (id: string) => Promise<void>;

  addAutomobile: (a: Omit<Automobile, "id">) => Promise<void>;
  updateAutomobile: (id: string, a: Omit<Automobile, "id">) => Promise<void>;
  deleteAutomobile: (id: string) => Promise<void>;

  resetToDefaults: () => void;
  refresh: () => Promise<void>;
}

const ListingsContext = createContext<ListingsValue | null>(null);

export function ListingsProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const [data, setData] = useState<ListingsData>(() =>
    isSupabaseConfigured ? { products: [], usedItems: [], automobiles: [] } : loadLocal()
  );
  const [source, setSource] = useState<"supabase" | "local">(
    isSupabaseConfigured ? "supabase" : "local"
  );
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  // Local mode mein har change localStorage mein save hota hai.
  useEffect(() => {
    if (source === "local") writeJSON(STORAGE_KEY, data);
  }, [data, source]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const [productRows, usedRows, autoRows] = await Promise.all([
        db.select<Row[]>("products", "select=*&order=created_at.desc"),
        db.select<Row[]>("used_items", "select=*&order=created_at.desc"),
        db.select<Row[]>("automobiles", "select=*&order=created_at.desc"),
      ]);
      setData({
        products: (productRows ?? []).map(productFromRow),
        usedItems: (usedRows ?? []).map(usedFromRow),
        automobiles: (autoRows ?? []).map(autoFromRow),
      });
      setSource("supabase");
      setError(null);
    } catch (err) {
      // Backend na chale to site khaali na dikhe — sample data par fallback.
      console.error("Listings load failed:", err);
      setData(loadLocal());
      setSource("local");
      setError("Couldn't load listings from the backend. Showing offline data for now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ListingsValue>(() => {
    const online = source === "supabase";

    async function mutate(run: () => Promise<void>) {
      try {
        await run();
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not save the changes.";
        setError(message);
        throw err;
      }
    }

    return {
      ...data,
      source,
      loading,
      error,
      refresh,

      addProduct: (p) =>
        mutate(async () => {
          if (online) {
            const row = { ...productToRow(p), ...(p.id ? { id: p.id } : {}) };
            await writeProductRow(row, (r) => db.insert("products", r, accessToken ?? undefined));
            await refresh();
          } else {
            const images = getProductImages(p);
            setData((d) => ({
              ...d,
              products: [
                { ...p, id: p.id ?? makeId("p"), image: images[0] ?? "", images },
                ...d.products,
              ],
            }));
          }
        }),
      updateProduct: (id, p) =>
        mutate(async () => {
          if (online) {
            assertChanged(
              await writeProductRow(productToRow(p), (row) =>
                db.update<Row[]>("products", `id=eq.${id}`, row, accessToken ?? undefined)
              ),
              "update"
            );
            await refresh();
          } else {
            const images = getProductImages(p);
            setData((d) => ({
              ...d,
              products: d.products.map((x) =>
                x.id === id ? { ...p, id, image: images[0] ?? "", images } : x
              ),
            }));
          }
        }),
      deleteProduct: (id) =>
        mutate(async () => {
          if (online) {
            const ownerId = data.products.find((x) => x.id === id)?.ownerId;
            assertChanged(await db.remove("products", `id=eq.${id}`, accessToken ?? undefined), "delete");
            // The listing is gone — also remove its uploaded photos from Storage.
            // Best effort: a cleanup hiccup must never make the delete look failed.
            void deleteProductFolder(id, ownerId, accessToken ?? undefined).catch((err) =>
              console.warn("Could not clean up product images:", err)
            );
            await refresh();
          } else {
            setData((d) => ({ ...d, products: d.products.filter((x) => x.id !== id) }));
          }
        }),

      addUsedItem: (u) =>
        mutate(async () => {
          if (online) {
            await db.insert("used_items", usedToRow(u), accessToken ?? undefined);
            await refresh();
          } else {
            setData((d) => ({ ...d, usedItems: [{ ...u, id: makeId("u") }, ...d.usedItems] }));
          }
        }),
      updateUsedItem: (id, u) =>
        mutate(async () => {
          if (online) {
            assertChanged(
              await db.update<Row[]>("used_items", `id=eq.${id}`, usedToRow(u), accessToken ?? undefined),
              "update"
            );
            await refresh();
          } else {
            setData((d) => ({
              ...d,
              usedItems: d.usedItems.map((x) => (x.id === id ? { ...u, id } : x)),
            }));
          }
        }),
      deleteUsedItem: (id) =>
        mutate(async () => {
          if (online) {
            assertChanged(await db.remove("used_items", `id=eq.${id}`, accessToken ?? undefined), "delete");
            await refresh();
          } else {
            setData((d) => ({ ...d, usedItems: d.usedItems.filter((x) => x.id !== id) }));
          }
        }),

      addAutomobile: (a) =>
        mutate(async () => {
          if (online) {
            await db.insert("automobiles", autoToRow(a), accessToken ?? undefined);
            await refresh();
          } else {
            setData((d) => ({ ...d, automobiles: [{ ...a, id: makeId("a") }, ...d.automobiles] }));
          }
        }),
      updateAutomobile: (id, a) =>
        mutate(async () => {
          if (online) {
            assertChanged(
              await db.update<Row[]>("automobiles", `id=eq.${id}`, autoToRow(a), accessToken ?? undefined),
              "update"
            );
            await refresh();
          } else {
            setData((d) => ({
              ...d,
              automobiles: d.automobiles.map((x) => (x.id === id ? { ...a, id } : x)),
            }));
          }
        }),
      deleteAutomobile: (id) =>
        mutate(async () => {
          if (online) {
            assertChanged(await db.remove("automobiles", `id=eq.${id}`, accessToken ?? undefined), "delete");
            await refresh();
          } else {
            setData((d) => ({ ...d, automobiles: d.automobiles.filter((x) => x.id !== id) }));
          }
        }),

      resetToDefaults: () => {
        if (online) return;
        setData(seedData);
      },
    };
  }, [data, source, loading, error, accessToken, refresh]);

  return <ListingsContext.Provider value={value}>{children}</ListingsContext.Provider>;
}

export function useListings() {
  const ctx = useContext(ListingsContext);
  if (!ctx) throw new Error("useListings must be used within ListingsProvider");
  return ctx;
}
