import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, X, RefreshCw } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import TableToolbar, { FilterSelect } from "../components/TableToolbar";
import { useUrlParam } from "../useUrlParam";
import { formatPKR } from "../../lib/format";
import { db, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../store/AuthStore";
import { orderFromRow, type Order } from "../../store/OrdersStore";

const ORDER_STATUSES: Order["status"][] = ["Placed", "Confirmed", "Shipped", "Delivered", "Cancelled"];

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const itemCount = (o: Order) => o.items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

export default function AdminOrders() {
  const { accessToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useUrlParam("q");
  const [status, setStatus] = useUrlParam("status", "all");
  const [payment, setPayment] = useState("all");
  const [viewing, setViewing] = useState<Order | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Admins can read every order through the "orders: read own or admin" RLS policy.
      const rows = await db.select<Record<string, unknown>[]>(
        "orders",
        "select=*&order=created_at.desc",
        accessToken ?? undefined
      );
      setOrders((rows ?? []).map(orderFromRow));
    } catch (err) {
      setOrders([]);
      setError(
        err instanceof Error
          ? `${err.message}; make sure supabase/orders.sql has been run in your Supabase project.`
          : "Could not load orders."
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const paymentOptions = useMemo(
    () =>
      Array.from(new Set(orders.map((o) => o.paymentMethod).filter(Boolean)))
        .sort()
        .map((p) => ({ value: p, label: p })),
    [orders]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesSearch =
        !q ||
        o.id.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.phone.toLowerCase().includes(q) ||
        o.customer.email.toLowerCase().includes(q);
      const matchesStatus = status === "all" || o.status === status;
      const matchesPayment = payment === "all" || o.paymentMethod === payment;
      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [orders, search, status, payment]);

  /** Admin status change. Allowed by the "orders: update own or admin" RLS policy. */
  async function changeStatus(order: Order, next: Order["status"]) {
    if (next === order.status) return;
    setActionError("");
    setBusyId(order.id);
    try {
      const updated = await db.update<Record<string, unknown>[]>(
        "orders",
        `id=eq.${encodeURIComponent(order.id)}`,
        { status: next },
        accessToken ?? undefined
      );
      if (!updated || updated.length === 0) {
        throw new Error("The database did not allow this change (no row was updated).");
      }
      const saved = orderFromRow(updated[0]);
      setOrders((prev) => prev.map((o) => (o.id === saved.id ? saved : o)));
      setViewing((v) => (v && v.id === saved.id ? saved : v));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update this order.");
    } finally {
      setBusyId(null);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="card-base p-6 text-sm text-ink-soft">
        Supabase isn't configured (missing <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>), so
        there are no orders to manage.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      <div className="card-base overflow-hidden">
        <TableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          placeholder="Search by order ID, name, phone or email..."
          resultCount={filtered.length}
        >
          <FilterSelect value={payment} onChange={setPayment} label="Payment" options={paymentOptions} />
          <FilterSelect
            value={status}
            onChange={setStatus}
            label="Status"
            options={ORDER_STATUSES.map((s) => ({ value: s, label: s }))}
          />
          <button
            onClick={() => void load()}
            disabled={loading}
            className="p-2.5 rounded-lg border border-surface-border text-ink-soft hover:text-ink disabled:opacity-50"
            aria-label="Refresh orders"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </TableToolbar>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-ink-soft uppercase tracking-wide border-b border-surface-border">
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-surface-alt">
                  <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">{o.id}</td>
                  <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{o.customer.name || "—"}</td>
                  <td className="px-4 py-3 text-center text-ink-soft">{itemCount(o)}</td>
                  <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{formatPKR(o.total)}</td>
                  <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{o.paymentMethod || "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      disabled={busyId === o.id}
                      onChange={(e) => void changeStatus(o, e.target.value as Order["status"])}
                      aria-label={`Status of order ${o.id}`}
                      className="rounded-lg border border-surface-border bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-400 disabled:opacity-60"
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{formatDate(o.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setViewing(o)}
                      className="p-1.5 rounded-md text-ink-soft hover:bg-surface-alt hover:text-ink"
                      aria-label={`View order ${o.id}`}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-ink-soft">
                    Loading orders…
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-red-700">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-ink-soft">
                    {orders.length === 0 ? "No orders yet." : "No orders match your search/filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order details modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewing(null)} />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto card-base p-5">
            <button
              onClick={() => setViewing(null)}
              className="absolute top-3 right-3 text-ink-soft hover:text-ink"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <p className="font-display font-bold text-ink pr-6">Order {viewing.id}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink-soft">
              <StatusBadge status={viewing.status.toLowerCase()} />
              <span>{formatDate(viewing.createdAt)}</span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-soft">Customer</dt>
                <dd className="font-medium text-ink">{viewing.customer.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Phone</dt>
                <dd className="font-medium text-ink">{viewing.customer.phone || "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-ink-soft">Email</dt>
                <dd className="font-medium text-ink break-all">{viewing.customer.email || "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-ink-soft">Address</dt>
                <dd className="font-medium text-ink">
                  {[viewing.customer.address, viewing.customer.city].filter(Boolean).join(", ") || "—"}
                </dd>
              </div>
              {viewing.customer.notes && (
                <div className="col-span-2">
                  <dt className="text-xs text-ink-soft">Notes</dt>
                  <dd className="font-medium text-ink">{viewing.customer.notes}</dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-xs text-ink-soft">Payment method</dt>
                <dd className="font-medium text-ink">{viewing.paymentMethod || "—"}</dd>
              </div>
            </dl>

            <ul className="mt-4 divide-y divide-surface-border border-y border-surface-border">
              {viewing.items.map((i, idx) => (
                <li key={`${i.id}-${idx}`} className="flex items-center gap-3 py-2 text-sm">
                  {i.image && <img src={i.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />}
                  <span className="flex-1 min-w-0 truncate text-ink">{i.title}</span>
                  <span className="text-ink-soft whitespace-nowrap">
                    {i.qty} × {formatPKR(i.price)}
                  </span>
                </li>
              ))}
              {viewing.items.length === 0 && <li className="py-2 text-sm text-ink-soft">No line items.</li>}
            </ul>

            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-ink-soft"><span>Subtotal</span><span>{formatPKR(viewing.subtotal)}</span></div>
              <div className="flex justify-between text-ink-soft"><span>Delivery</span><span>{formatPKR(viewing.delivery)}</span></div>
              <div className="flex justify-between font-semibold text-ink"><span>Total</span><span>{formatPKR(viewing.total)}</span></div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-ink-soft mb-1">Update status</label>
              <select
                value={viewing.status}
                disabled={busyId === viewing.id}
                onChange={(e) => void changeStatus(viewing, e.target.value as Order["status"])}
                className="input-base"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
