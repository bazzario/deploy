import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import RequireAuth from "../components/RequireAuth";
import StatusBadge from "../admin/components/StatusBadge";
import { useAuth } from "../store/AuthStore";
import { isSupabaseConfigured } from "../lib/supabase";
import { describeSellerOrdersError, fetchSellerOrder, type SellerOrder } from "../lib/sellerOrders";
import { markOrderRead } from "../lib/sellerNotifications";
import { formatPKR } from "../lib/format";

export default function SellerOrderDetail() {
  return (
    <RequireAuth>
      <SellerOrderView />
    </RequireAuth>
  );
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; order: SellerOrder | null };

function SellerOrderView() {
  const { id = "" } = useParams();
  const { user, accessToken } = useAuth();
  const sellerId = user?.id ?? null;
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!isSupabaseConfigured || !sellerId || !accessToken || !id) {
      setState({ kind: "ready", order: null });
      return;
    }

    let cancelled = false;
    setState({ kind: "loading" });

    fetchSellerOrder(sellerId, id, accessToken)
      .then((order) => {
        if (!cancelled) setState({ kind: "ready", order });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: "error", message: describeSellerOrdersError(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [id, sellerId, accessToken]);

  // Opening the order marks THIS seller's notification for it as read — nobody
  // else's. Only done once the order really loaded through the seller-scoped view
  // (so it is one of this seller's), and the database function acts on the
  // caller's own auth.uid() regardless of what is sent. Best effort: a failure
  // here must never stop the seller from seeing the order.
  const markedOrderId = useRef<string | null>(null);
  const loadedOrderId = state.kind === "ready" && state.order ? state.order.id : null;
  useEffect(() => {
    if (!loadedOrderId || !accessToken || markedOrderId.current === loadedOrderId) return;
    markedOrderId.current = loadedOrderId;
    markOrderRead(loadedOrderId, accessToken).catch((err: unknown) => {
      markedOrderId.current = null;
      console.warn("Could not mark the order as read:", err);
    });
  }, [loadedOrderId, accessToken]);

  if (state.kind === "loading") {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-sm text-ink-soft">Loading order…</p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-sm text-red-700">{state.message}</p>
        <Link to="/seller" className="btn-primary mt-4 inline-flex">Back to Seller Dashboard</Link>
      </div>
    );
  }

  const order = state.order;

  // Same message whether the order doesn't exist or belongs to someone else's
  // products, so this page can't be used to probe for other sellers' order ids.
  if (!order) {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-ink-soft">This order could not be found.</p>
        <Link to="/seller" className="btn-primary mt-4 inline-flex">Back to Seller Dashboard</Link>
      </div>
    );
  }

  const buyer = order.buyer;
  const address = [buyer.address, buyer.city].filter(Boolean).join(", ");

  return (
    <div className="container-page py-6 sm:py-8 max-w-2xl">
      <div className="flex items-center gap-1 text-xs text-ink-soft mb-4">
        <Link to="/seller" className="hover:text-brand-600">Seller Dashboard</Link>
        <ChevronRight size={12} />
        <span>Orders</span>
        <ChevronRight size={12} />
        <span className="text-ink break-all">{order.id}</span>
      </div>

      <div className="card-base p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-display font-bold text-xl text-ink break-all">Order {order.id}</h1>
          <StatusBadge status={order.status.toLowerCase()} />
        </div>
        <p className="text-xs text-ink-soft mt-2">{new Date(order.createdAt).toLocaleString()}</p>
      </div>

      <div className="card-base p-4 mt-4">
        <h2 className="font-semibold text-ink mb-3">Your items in this order</h2>
        <div className="flex flex-col gap-3">
          {order.lines.map((line, idx) => (
            <div key={`${line.id}-${idx}`} className="flex items-center gap-3">
              {line.image ? (
                <img
                  src={line.image}
                  alt={line.title}
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-surface-alt"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg flex-shrink-0 bg-surface-alt" />
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
            </div>
          ))}
        </div>

        <div className="border-t border-surface-border mt-4 pt-3 flex items-center justify-between font-display font-bold text-base text-ink">
          <span>Your subtotal</span>
          <span>{formatPKR(order.subtotal)}</span>
        </div>
      </div>

      <div className="card-base p-4 mt-4">
        <h2 className="font-semibold text-ink mb-3">Buyer &amp; delivery</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-ink-soft">Name</dt>
            <dd className="font-medium text-ink">{buyer.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Phone</dt>
            <dd className="font-medium text-ink">
              {buyer.phone ? (
                <a href={`tel:${buyer.phone}`} className="text-brand-600">{buyer.phone}</a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-ink-soft">Email</dt>
            <dd className="font-medium text-ink break-all">
              {buyer.email ? (
                <a href={`mailto:${buyer.email}`} className="text-brand-600">{buyer.email}</a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-ink-soft">Delivery address</dt>
            <dd className="font-medium text-ink">{address || "—"}</dd>
          </div>
          {buyer.notes && (
            <div className="col-span-2">
              <dt className="text-xs text-ink-soft">Order notes</dt>
              <dd className="font-medium text-ink">{buyer.notes}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-xs text-ink-soft">Payment method</dt>
            <dd className="font-medium text-ink">{order.paymentMethod || "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
