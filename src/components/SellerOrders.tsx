import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, ChevronRight, Mail, PackageSearch, Phone, RefreshCw, User, X } from "lucide-react";
import StatusBadge from "../admin/components/StatusBadge";
import { useAuth } from "../store/AuthStore";
import { useSellerNotifications } from "../hooks/useSellerNotifications";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  describeSellerOrdersError,
  fetchSellerOrder,
  fetchSellerOrderCount,
  fetchSellerOrders,
  type SellerOrder,
} from "../lib/sellerOrders";
import { fetchUnread, type SellerNotification } from "../lib/sellerNotifications";
import type { NotificationEvent } from "../lib/realtime";
import { formatPKR } from "../lib/format";

const PAGE_SIZE = 20;
const TOAST_MS = 7000;

interface UnreadState {
  count: number;
  ids: Set<string>;
}

interface Toast {
  orderId: string;
  message: string;
}

const byNewest = (a: SellerOrder, b: SellerOrder) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

/**
 * Orders section of the seller dashboard.
 *
 * Data comes from two seller-scoped places, both enforced by the database:
 *   - the `seller_orders` view (only this seller's orders, only their own lines);
 *   - `seller_order_notifications` (this seller's own read/unread state).
 * Loading always works through plain REST. Realtime is layered on top: when a new
 * order arrives for THIS seller the list, the unread count and a toast update in
 * place. If realtime can't connect, everything above still works via the refresh
 * button and a normal page load.
 */
export default function SellerOrders() {
  const { user, accessToken } = useAuth();
  const sellerId = user?.id ?? null;
  const hasToken = Boolean(accessToken);

  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [rowsLoaded, setRowsLoaded] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [unread, setUnread] = useState<UnreadState | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Rotating tokens must not restart loading or the subscription — read the latest on demand.
  const tokenRef = useRef<string | undefined>(accessToken ?? undefined);
  useEffect(() => {
    tokenRef.current = accessToken ?? undefined;
  }, [accessToken]);

  // Only the newest load of each kind may write state; a slow older response is
  // ignored. Silent resyncs have their own counter so they can never cancel the
  // initial/explicit load (which owns pagination state and the spinner).
  const loadSeq = useRef(0);
  const silentSeq = useRef(0);
  const toastTimers = useRef(new Map<string, number>());

  /** Re-read the exact order count and unread state (cheap; no list change). */
  const refreshCounts = useCallback(async () => {
    const token = tokenRef.current;
    if (!isSupabaseConfigured || !sellerId || !token) return;
    const [count, unreadState] = await Promise.all([
      fetchSellerOrderCount(token).catch(() => null),
      fetchUnread(sellerId, token).catch((err: unknown) => {
        console.warn("Could not load unread orders:", err);
        return null;
      }),
    ]);
    if (count !== null) setTotal(count);
    if (unreadState) setUnread({ count: unreadState.count, ids: new Set(unreadState.ids) });
  }, [sellerId]);

  /**
   * Load page 1 + counts. `silent` (used when realtime reconnects) keeps what is
   * on screen, merges anything new in, and never shows a spinner or an error.
   */
  const load = useCallback(
    async (silent: boolean) => {
      const token = tokenRef.current;
      if (!isSupabaseConfigured || !sellerId || !token) {
        setLoading(false);
        return;
      }

      const seq = silent ? silentSeq : loadSeq;
      const id = ++seq.current;
      if (!silent) {
        setLoading(true);
        setError("");
      }

      try {
        const [page] = await Promise.all([
          fetchSellerOrders(sellerId, token, { limit: PAGE_SIZE, offset: 0 }),
          refreshCounts(),
        ]);
        if (id !== seq.current) return;

        if (silent) {
          setOrders((prev) => {
            const fresh = new Set(page.orders.map((o) => o.id));
            return [...page.orders, ...prev.filter((o) => !fresh.has(o.id))].sort(byNewest);
          });
        } else {
          setOrders(page.orders);
          setRowsLoaded(page.rowCount);
          setHasMore(page.rowCount === PAGE_SIZE);
        }
      } catch (err) {
        if (id === seq.current && !silent) setError(describeSellerOrdersError(err));
      } finally {
        if (!silent && id === seq.current) setLoading(false);
      }
    },
    [sellerId, refreshCounts]
  );

  // hasToken: load again if the token only becomes available after mount.
  useEffect(() => {
    void load(false);
    return () => {
      loadSeq.current++;
      silentSeq.current++;
    };
  }, [load, hasToken, reloadKey]);

  const dismissToast = useCallback((orderId: string) => {
    const timer = toastTimers.current.get(orderId);
    if (timer !== undefined) window.clearTimeout(timer);
    toastTimers.current.delete(orderId);
    setToasts((prev) => prev.filter((t) => t.orderId !== orderId));
  }, []);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const showToast = useCallback(
    (notification: SellerNotification) => {
      const share = notification.subtotal > 0 ? `, your share ${formatPKR(notification.subtotal)}` : "";
      const message = `New order ${notification.orderId}${share}`;
      setToasts((prev) =>
        prev.some((t) => t.orderId === notification.orderId)
          ? prev
          : [...prev, { orderId: notification.orderId, message }].slice(-3)
      );
      const existing = toastTimers.current.get(notification.orderId);
      if (existing !== undefined) window.clearTimeout(existing);
      toastTimers.current.set(
        notification.orderId,
        window.setTimeout(() => dismissToast(notification.orderId), TOAST_MS)
      );
    },
    [dismissToast]
  );

  /** A notification row for this seller changed (already RLS-scoped and re-checked). */
  const handleEvent = useCallback(
    async (event: NotificationEvent) => {
      const { notification } = event;

      // Instant, optimistic unread update; refreshCounts() below makes it exact.
      setUnread((prev) => {
        const ids = new Set(prev?.ids ?? []);
        const had = ids.has(notification.orderId);
        if (notification.readAt === null) ids.add(notification.orderId);
        else ids.delete(notification.orderId);
        const delta = notification.readAt === null ? (had ? 0 : 1) : had ? -1 : 0;
        return { ids, count: Math.max(0, (prev?.count ?? 0) + delta) };
      });

      if (event.type === "INSERT") {
        const token = tokenRef.current;
        if (sellerId && token) {
          // The order itself is fetched through the seller-scoped view, so only this
          // seller's lines come back — the notification carries no order details.
          const order = await fetchSellerOrder(sellerId, notification.orderId, token).catch(() => null);
          if (order) {
            setOrders((prev) =>
              prev.some((o) => o.id === order.id) ? prev : [order, ...prev].sort(byNewest)
            );
          } else {
            void load(true);
          }
        }
        if (notification.readAt === null) showToast(notification);
      }

      void refreshCounts();
    },
    [sellerId, load, showToast, refreshCounts]
  );

  const realtime = useSellerNotifications({
    onEvent: (event) => void handleEvent(event),
    // (Re)joined the channel: anything sent while it was down is gone, so re-read.
    onResync: () => void load(true),
  });

  async function loadMore() {
    const token = tokenRef.current;
    if (!sellerId || !token || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchSellerOrders(sellerId, token, { limit: PAGE_SIZE, offset: rowsLoaded });
      setOrders((prev) => {
        const seen = new Set(prev.map((o) => o.id));
        return [...prev, ...page.orders.filter((o) => !seen.has(o.id))];
      });
      setRowsLoaded((n) => n + page.rowCount);
      setHasMore(page.rowCount === PAGE_SIZE);
    } catch (err) {
      setError(describeSellerOrdersError(err));
    } finally {
      setLoadingMore(false);
    }
  }

  const unreadLabel = unread ? String(unread.count) : loading ? "…" : "—";

  return (
    <section className="mt-8" aria-labelledby="seller-orders-title">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 id="seller-orders-title" className="section-title !text-base">
            Orders
          </h2>
          {isSupabaseConfigured && realtime === "live" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Live
            </span>
          )}
        </div>
        {isSupabaseConfigured && (
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            aria-label="Refresh orders"
            className="p-2 text-ink-soft hover:text-brand-600 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {!isSupabaseConfigured ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            Orders from buyers are only available when the backend is connected.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="card-base p-4">
              <div className="flex items-center justify-between">
                <PackageSearch size={18} className="text-brand-500" />
              </div>
              <p className="font-display font-bold text-2xl text-ink mt-2">
                {loading ? "…" : (total ?? orders.length)}
              </p>
              <p className="text-xs text-ink-soft mt-0.5">Total orders</p>
            </div>

            <div className="card-base p-4">
              <div className="flex items-center justify-between">
                <Bell size={18} className="text-brand-500" />
              </div>
              <p className="font-display font-bold text-2xl text-ink mt-2" aria-live="polite">
                {unreadLabel}
              </p>
              <p className="text-xs text-ink-soft mt-0.5">New / unread · {unreadLabel}</p>
            </div>
          </div>

          {realtime === "unavailable" && (
            <p className="text-[11px] text-ink-soft mt-2">
              Live updates aren't connected right now. Use the refresh button to check for new orders.
            </p>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 mt-4">
              <p className="text-xs text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-ink-soft mt-4">Loading your orders…</p>
          ) : orders.length === 0 && !error ? (
            <div className="card-base p-6 sm:p-8 mt-4 text-center">
              <PackageSearch size={28} className="mx-auto text-brand-500" />
              <p className="text-sm font-semibold text-ink mt-3">No orders yet</p>
              <p className="text-xs text-ink-soft mt-1">
                When a buyer orders one of your products, it will show up here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mt-4">
              {orders.map((order) => (
                <SellerOrderCard key={order.id} order={order} unread={unread?.ids.has(order.id) ?? false} />
              ))}

              {hasMore && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="btn-secondary !py-2 text-xs self-center"
                >
                  {loadingMore ? "Loading…" : "Load more orders"}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {toasts.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto sm:w-80 z-50 flex flex-col gap-2"
        >
          {toasts.map((t) => (
            <div
              key={t.orderId}
              className="card-base p-3 flex items-start gap-2 shadow-lg border-brand-400 bg-white"
            >
              <Bell size={16} className="text-brand-500 flex-shrink-0 mt-0.5" />
              <Link
                to={`/seller/orders/${encodeURIComponent(t.orderId)}`}
                onClick={() => dismissToast(t.orderId)}
                className="text-xs text-ink flex-1 min-w-0 break-words"
              >
                {t.message}
              </Link>
              <button
                type="button"
                onClick={() => dismissToast(t.orderId)}
                aria-label="Dismiss notification"
                className="text-ink-soft hover:text-ink flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SellerOrderCard({ order, unread }: { order: SellerOrder; unread: boolean }) {
  return (
    <Link
      to={`/seller/orders/${encodeURIComponent(order.id)}`}
      className="card-base p-4 block hover:border-brand-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-ink break-all">{order.id}</span>
            <StatusBadge status={order.status.toLowerCase()} />
            {unread && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 text-white text-[10px] font-semibold px-2 py-0.5">
                New
              </span>
            )}
          </div>
          <p className="text-xs text-ink-soft mt-1">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <ChevronRight size={18} className="text-ink-soft flex-shrink-0 mt-0.5" />
      </div>

      <div className="grid sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-ink-soft mt-3">
        <span className="flex items-center gap-1.5 min-w-0">
          <User size={13} className="flex-shrink-0" />
          <span className="truncate text-ink">{order.buyer.name || "—"}</span>
        </span>
        <span className="flex items-center gap-1.5 min-w-0">
          <Phone size={13} className="flex-shrink-0" />
          <span className="truncate text-ink">{order.buyer.phone || "—"}</span>
        </span>
        <span className="flex items-center gap-1.5 min-w-0">
          <Mail size={13} className="flex-shrink-0" />
          <span className="truncate text-ink">{order.buyer.email || "—"}</span>
        </span>
      </div>

      <ul className="mt-3 divide-y divide-surface-border border-y border-surface-border">
        {order.lines.map((line, idx) => (
          <li key={`${line.id}-${idx}`} className="flex items-center gap-3 py-2">
            {line.image ? (
              <img
                src={line.image}
                alt={line.title}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-surface-alt"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg flex-shrink-0 bg-surface-alt" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink line-clamp-2">{line.title}</p>
              <p className="text-xs text-ink-soft mt-0.5">
                Qty {line.qty} × {formatPKR(line.price)}
              </p>
            </div>
            <span className="text-sm font-medium text-ink flex-shrink-0">
              {formatPKR(line.price * line.qty)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3 text-xs mt-3">
        <span className="text-ink-soft">{order.paymentMethod || "—"}</span>
        <span className="text-ink-soft">
          Your subtotal <span className="font-display font-bold text-sm text-ink ml-1">{formatPKR(order.subtotal)}</span>
        </span>
      </div>
    </Link>
  );
}
