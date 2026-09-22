import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import TableToolbar, { FilterSelect } from "../components/TableToolbar";
import { useUrlParam } from "../useUrlParam";
import { db, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../store/AuthStore";
import { orderFromRow, type Order } from "../../store/OrdersStore";

/**
 * Delivery view of the real `orders` table (read with the admin's own session,
 * so RLS applies): where each order is going and how far along it is.
 *
 * NOT available yet: courier name, tracking number and "last update" time.
 * The database has no `deliveries` table and `orders` has no courier /
 * tracking_number / updated_at columns, so those are not shown rather than
 * being made up. The status dropdown changes `orders.status` — the same action
 * as on the Orders page — which is the only delivery state that exists today.
 */

const ORDER_STATUSES: Order["status"][] = ["Placed", "Confirmed", "Shipped", "Delivered", "Cancelled"];

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function itemsSummary(o: Order) {
  if (o.items.length === 0) return "—";
  const first = o.items[0];
  const label = `${first.title}${Number(first.qty) > 1 ? ` ×${first.qty}` : ""}`;
  return o.items.length > 1 ? `${label} + ${o.items.length - 1} more` : label;
}

export default function AdminDelivery() {
  const { accessToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useUrlParam("q");
  const [status, setStatus] = useState("all");
  const [city, setCity] = useState("all");

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
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

  const cityOptions = useMemo(
    () =>
      Array.from(new Set(orders.map((o) => o.customer.city.trim()).filter(Boolean)))
        .sort()
        .map((c) => ({ value: c, label: c })),
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
        o.customer.address.toLowerCase().includes(q) ||
        o.customer.city.toLowerCase().includes(q);
      const matchesStatus = status === "all" || o.status === status;
      const matchesCity = city === "all" || o.customer.city.trim() === city;
      return matchesSearch && matchesStatus && matchesCity;
    });
  }, [orders, search, status, city]);

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
        there are no deliveries to show.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
        Courier and tracking numbers aren't stored yet. The database has no <code>deliveries</code> table (or
        courier / tracking columns on <code>orders</code>). Until one exists, this page shows each order's real
        delivery address and status.
      </div>

      {actionError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      <div className="card-base overflow-hidden">
        <TableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          placeholder="Search by order, customer, phone or address..."
          resultCount={filtered.length}
        >
          <FilterSelect value={city} onChange={setCity} label="City" options={cityOptions} />
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
            aria-label="Refresh deliveries"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </TableToolbar>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-ink-soft uppercase tracking-wide border-b border-surface-border">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Product/Items</th>
                <th className="px-4 py-3">Deliver to</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-surface-alt">
                  <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">{o.id}</td>
                  <td className="px-4 py-3 text-ink-soft whitespace-nowrap">
                    {o.customer.name || "—"}
                    {o.customer.phone && <span className="block text-xs">{o.customer.phone}</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{itemsSummary(o)}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {[o.customer.address, o.customer.city].filter(Boolean).join(", ") || "—"}
                  </td>
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
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-soft">
                    Loading deliveries…
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-red-700">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-soft">
                    {orders.length === 0 ? "No orders yet." : "No deliveries match your search/filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
