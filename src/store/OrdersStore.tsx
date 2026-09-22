import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePersistentState } from "../lib/storage";
import { db, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "./AuthStore";

export interface OrderLine {
  id: string;
  title: string;
  price: number;
  qty: number;
  image: string;
  /**
   * Owner (auth user id) of the product when it was bought — `products.owner_id`.
   * `null` when the listing had no owner (e.g. admin/seed products) or when the
   * order was placed before seller ownership was recorded.
   *
   * Never taken from anything the buyer types. The checkout copies it from the
   * product record, and the database re-stamps it on insert (see
   * supabase/orders.sql), so it cannot be forged through the REST API either.
   */
  sellerId: string | null;
}

export interface Order {
  id: string;
  createdAt: string;
  status: "Placed" | "Confirmed" | "Shipped" | "Delivered" | "Cancelled";
  items: OrderLine[];
  subtotal: number;
  delivery: number;
  total: number;
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    notes: string;
  };
  paymentMethod: string;
  buyerId?: string;
}

/**
 * Order lines saved before `sellerId` existed (in Supabase or in the browser
 * cache) have no such key. These "stored" shapes describe that; everything that
 * reads them goes through `normalizeOrderLine`, so the rest of the app only ever
 * sees a full `OrderLine`.
 */
export type StoredOrderLine = Omit<OrderLine, "sellerId"> & { sellerId?: string | null };
type StoredOrder = Omit<Order, "items"> & { items: StoredOrderLine[] };

interface OrdersValue {
  orders: Order[];
  loading: boolean;
  placeOrder: (order: Omit<Order, "id" | "createdAt" | "status" | "buyerId">) => Promise<Order>;
  findOrder: (id: string) => Order | undefined;
  cancelOrder: (id: string) => Promise<void>;
}

/**
 * Har order is browser mein bhi cache hota hai, taake guest checkout (bina
 * login) karne wala buyer bhi apna order isi device par track kar sake, chahe
 * Supabase RLS us row ko wapas fetch na hone de. Login user ke liye source of
 * truth Supabase hai — cache sirf fallback/offline copy hai.
 */
const ORDERS_CACHE_KEY = "bazaario_orders_v1";

const OrdersContext = createContext<OrdersValue | null>(null);

function makeOrderId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `BZ-${stamp}-${rand}`;
}

type Row = Record<string, unknown>;

/** Old lines without a (valid) `sellerId` become `sellerId: null`; nothing else changes. */
export function normalizeOrderLine(line: StoredOrderLine): OrderLine {
  return {
    ...line,
    sellerId: typeof line.sellerId === "string" && line.sellerId !== "" ? line.sellerId : null,
  };
}

function normalizeOrder(order: StoredOrder): Order {
  return { ...order, items: (order.items ?? []).map(normalizeOrderLine) };
}

export function orderFromRow(r: Row): Order {
  return {
    id: String(r.id),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    status: (r.status as Order["status"]) ?? "Placed",
    items: Array.isArray(r.items) ? (r.items as StoredOrderLine[]).map(normalizeOrderLine) : [],
    subtotal: Number(r.subtotal ?? 0),
    delivery: Number(r.delivery ?? 0),
    total: Number(r.total ?? 0),
    customer:
      (r.customer as Order["customer"]) ??
      { name: "", phone: "", email: "", address: "", city: "", notes: "" },
    paymentMethod: String(r.payment_method ?? ""),
    buyerId: r.buyer_id ? String(r.buyer_id) : undefined,
  };
}

function orderToInsertRow(o: Order): Row {
  return {
    id: o.id,
    status: o.status,
    items: o.items,
    subtotal: o.subtotal,
    delivery: o.delivery,
    total: o.total,
    customer: o.customer,
    payment_method: o.paymentMethod,
    buyer_id: o.buyerId ?? null,
  };
}

function sortByNewest(list: Order[]) {
  return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function mergeOrders(primary: Order[], fallback: Order[]) {
  const map = new Map<string, Order>();
  for (const o of fallback) map.set(o.id, o);
  for (const o of primary) map.set(o.id, o); // supabase copy wins on conflict
  return sortByNewest(Array.from(map.values()));
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  // The browser cache may hold orders from before `sellerId` existed.
  const [cache, setCache] = usePersistentState<StoredOrder[]>(ORDERS_CACHE_KEY, []);
  const [remote, setRemote] = useState<Order[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setRemote([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await db.select<Row[]>(
        "orders",
        `select=*&buyer_id=eq.${user.id}&order=created_at.desc`,
        accessToken ?? undefined
      );
      setRemote((rows ?? []).map(orderFromRow));
    } catch (err) {
      console.error("Orders load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user, accessToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const orders = useMemo(() => {
    const local = cache.map(normalizeOrder);
    return isSupabaseConfigured ? mergeOrders(remote, local) : sortByNewest(local);
  }, [remote, cache]);

  const value = useMemo<OrdersValue>(
    () => ({
      orders,
      loading,
      placeOrder: async (draft) => {
        const order: Order = {
          ...draft,
          id: makeOrderId(),
          createdAt: new Date().toISOString(),
          status: "Placed",
          buyerId: user?.id,
        };

        if (isSupabaseConfigured) {
          try {
            // The response body isn't used, so don't request it: reading the new row
            // back needs SELECT access, which a guest (buyer_id is null) doesn't have.
            await db.insert("orders", orderToInsertRow(order), accessToken ?? undefined, {
              returnRow: false,
            });
          } catch (err) {
            // Backend save fail ho jaye to bhi order local cache mein rehta hai
            // taake buyer isi browser mein apna order dekh sake.
            console.error("Could not save order to the backend, kept a local copy:", err);
          }
        }

        setCache((prev) => [order, ...prev]);
        void refresh();
        return order;
      },
      findOrder: (id) => orders.find((o) => o.id === id),
      cancelOrder: async (id) => {
        setCache((prev) => prev.map((o) => (o.id === id ? { ...o, status: "Cancelled" } : o)));
        if (isSupabaseConfigured) {
          try {
            await db.update("orders", `id=eq.${id}`, { status: "Cancelled" }, accessToken ?? undefined);
          } catch (err) {
            console.error("Order cancellation could not be synced to the backend:", err);
          }
          void refresh();
        }
      },
    }),
    [orders, loading, user, accessToken, setCache, refresh]
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
