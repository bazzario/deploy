import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Package,
  ListChecks,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  RefreshCw,
} from "lucide-react";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { LineChart, DonutChart } from "../components/Charts";
import { db, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../store/AuthStore";
import { orderFromRow, type Order } from "../../store/OrdersStore";
import { formatPKR } from "../../lib/format";

/**
 * Every number on this page comes from live Supabase queries made with the
 * signed-in admin's own session (so Row Level Security still applies):
 *   Users    -> profiles          Products -> products
 *   Listings -> used_items + automobiles
 *   Orders   -> orders (total, and one count per real orders.status value)
 * Nothing is hardcoded — an empty database simply shows 0. If a query fails the
 * card shows "—" (unknown) and a message explains why, instead of a fake 0.
 */

type Row = Record<string, unknown>;
type OrderStatus = Order["status"];

const ORDER_STATUS_META: { status: OrderStatus; color: string }[] = [
  { status: "Placed", color: "#F59E0B" },
  { status: "Confirmed", color: "#8B5CF6" },
  { status: "Shipped", color: "#0EA5E9" },
  { status: "Delivered", color: "#10B981" },
  { status: "Cancelled", color: "#EF4444" },
];

interface ListingBrief {
  key: string;
  title: string;
  seller: string;
  location: string;
  verified: boolean;
  createdAt: string;
}

interface DashboardData {
  users: number | null;
  products: number | null;
  usedItems: number | null;
  automobiles: number | null;
  orders: number | null;
  statusCounts: Record<OrderStatus, number | null>;
  trendLabels: string[];
  trendUsers: number[];
  trendOrders: number[];
  recentOrders: Order[];
  recentListings: ListingBrief[];
  unverified: ListingBrief[];
}

const emptyData: DashboardData = {
  users: null,
  products: null,
  usedItems: null,
  automobiles: null,
  orders: null,
  statusCounts: { Placed: null, Confirmed: null, Shipped: null, Delivered: null, Cancelled: null },
  trendLabels: [],
  trendUsers: [],
  trendOrders: [],
  recentOrders: [],
  recentListings: [],
  unverified: [],
};

const SIX_MONTHS = 6;

/** Start of each of the last 6 calendar months (oldest first) plus the end boundary. */
function monthBuckets() {
  const now = new Date();
  const buckets: { label: string; from: string; to: string }[] = [];
  for (let i = SIX_MONTHS - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    buckets.push({
      label: start.toLocaleString("en-US", { month: "short" }),
      from: start.toISOString(),
      to: end.toISOString(),
    });
  }
  return buckets;
}

const usedBrief = (r: Row): ListingBrief => ({
  key: `u-${String(r.id)}`,
  title: String(r.title ?? "Untitled"),
  seller: String(r.seller ?? ""),
  location: String(r.location ?? ""),
  verified: r.verified === true,
  createdAt: String(r.created_at ?? ""),
});

const autoBrief = (r: Row): ListingBrief => ({
  key: `a-${String(r.id)}`,
  title: `${r.year ?? ""} ${r.make ?? ""} ${r.model ?? ""}`.replace(/\s+/g, " ").trim() || "Untitled",
  seller: String(r.seller ?? ""),
  location: String(r.location ?? ""),
  verified: r.verified === true,
  createdAt: String(r.created_at ?? ""),
});

function newestFirst(a: ListingBrief, b: ListingBrief) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

const show = (n: number | null) => (n === null ? "—" : n.toLocaleString());

export default function AdminDashboard() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [problems, setProblems] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const token = accessToken ?? undefined;
    const failures = new Set<string>();

    // Runs one query; on failure records why and returns null (shown as "—").
    async function safe<T>(label: string, run: () => Promise<T>): Promise<T | null> {
      try {
        return await run();
      } catch (err) {
        failures.add(`${label}: ${err instanceof Error ? err.message : "request failed"}`);
        return null;
      }
    }

    const buckets = monthBuckets();
    const range = (b: { from: string; to: string }) =>
      `created_at=gte.${encodeURIComponent(b.from)}&created_at=lt.${encodeURIComponent(b.to)}`;

    const [
      users,
      products,
      usedItems,
      automobiles,
      orders,
      statusResults,
      userMonths,
      orderMonths,
      recentOrderRows,
      recentUsedRows,
      recentAutoRows,
      unverifiedUsedRows,
      unverifiedAutoRows,
    ] = await Promise.all([
      safe("Users", () => db.count("profiles", "", token)),
      safe("Products", () => db.count("products", "", token)),
      safe("Used items", () => db.count("used_items", "", token)),
      safe("Automobiles", () => db.count("automobiles", "", token)),
      safe("Orders", () => db.count("orders", "", token)),
      Promise.all(
        ORDER_STATUS_META.map(({ status }) =>
          safe("Order statuses", () => db.count("orders", `status=eq.${encodeURIComponent(status)}`, token))
        )
      ),
      Promise.all(buckets.map((b) => safe("Users trend", () => db.count("profiles", range(b), token)))),
      Promise.all(buckets.map((b) => safe("Orders trend", () => db.count("orders", range(b), token)))),
      safe("Recent orders", () =>
        db.select<Row[]>("orders", "select=*&order=created_at.desc&limit=5", token)
      ),
      safe("Recent used items", () =>
        db.select<Row[]>(
          "used_items",
          "select=id,title,seller,location,verified,created_at&order=created_at.desc&limit=5",
          token
        )
      ),
      safe("Recent automobiles", () =>
        db.select<Row[]>(
          "automobiles",
          "select=id,make,model,year,seller,location,verified,created_at&order=created_at.desc&limit=5",
          token
        )
      ),
      safe("Unverified used items", () =>
        db.select<Row[]>(
          "used_items",
          "select=id,title,seller,location,verified,created_at&verified=eq.false&order=created_at.desc&limit=5",
          token
        )
      ),
      safe("Unverified automobiles", () =>
        db.select<Row[]>(
          "automobiles",
          "select=id,make,model,year,seller,location,verified,created_at&verified=eq.false&order=created_at.desc&limit=5",
          token
        )
      ),
    ]);

    const statusCounts = { ...emptyData.statusCounts };
    ORDER_STATUS_META.forEach(({ status }, i) => {
      statusCounts[status] = statusResults[i];
    });

    setData({
      users,
      products,
      usedItems,
      automobiles,
      orders,
      statusCounts,
      trendLabels: buckets.map((b) => b.label),
      trendUsers: userMonths.map((n) => n ?? 0),
      trendOrders: orderMonths.map((n) => n ?? 0),
      recentOrders: (recentOrderRows ?? []).map(orderFromRow),
      recentListings: [
        ...(recentUsedRows ?? []).map(usedBrief),
        ...(recentAutoRows ?? []).map(autoBrief),
      ]
        .sort(newestFirst)
        .slice(0, 5),
      unverified: [
        ...(unverifiedUsedRows ?? []).map(usedBrief),
        ...(unverifiedAutoRows ?? []).map(autoBrief),
      ]
        .sort(newestFirst)
        .slice(0, 5),
    });
    setProblems(Array.from(failures));
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const listings =
    data.usedItems === null || data.automobiles === null ? null : data.usedItems + data.automobiles;

  const statusIcons: Record<OrderStatus, typeof Clock> = {
    Placed: Clock,
    Confirmed: CheckCircle2,
    Shipped: Truck,
    Delivered: PackageCheck,
    Cancelled: XCircle,
  };
  const statusTones: Record<OrderStatus, "amber" | "purple" | "blue" | "green" | "red"> = {
    Placed: "amber",
    Confirmed: "purple",
    Shipped: "blue",
    Delivered: "green",
    Cancelled: "red",
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="card-base p-6 text-sm text-ink-soft">
        Supabase isn't configured (missing <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>), so
        there are no statistics to show.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {problems.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Some statistics couldn't be loaded (shown as "—"):</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">
            Check that <code>supabase/admin-setup.sql</code> and <code>supabase/orders.sql</code> have been run and
            that you're signed in as an admin.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <StatCard label="Total Users" value={show(data.users)} icon={Users} tone="brand" />
        <StatCard label="Products" value={show(data.products)} icon={Package} tone="blue" />
        <StatCard label="Listings" value={show(listings)} icon={ListChecks} tone="green" />
        <StatCard label="Total Orders" value={show(data.orders)} icon={ShoppingCart} tone="brand" />
        {ORDER_STATUS_META.map(({ status }) => (
          <StatCard
            key={status}
            label={status}
            value={show(data.statusCounts[status])}
            icon={statusIcons[status]}
            tone={statusTones[status]}
          />
        ))}
      </div>

      {/* Analytics preview + order status summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card-base p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-ink">Growth overview</h2>
            <Link to="/admin/analytics" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Full analytics →
            </Link>
          </div>
          <LineChart
            labels={data.trendLabels.length ? data.trendLabels : monthBuckets().map((b) => b.label)}
            series={[
              { name: "New users", data: data.trendUsers.length ? data.trendUsers : new Array(SIX_MONTHS).fill(0), color: "#E8590C" },
              { name: "New orders", data: data.trendOrders.length ? data.trendOrders : new Array(SIX_MONTHS).fill(0), color: "#0EA5E9" },
            ]}
          />
        </div>

        <div className="card-base p-4">
          <h2 className="font-display font-bold text-ink mb-3">Order Status Summary</h2>
          <DonutChart
            segments={ORDER_STATUS_META.map(({ status, color }) => ({
              label: status,
              value: data.statusCounts[status] ?? 0,
              color,
            }))}
            size={150}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <div className="card-base p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-ink">Recent Orders</h2>
            <Link to="/admin/orders" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              View all →
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-ink-soft py-4 text-center">{loading ? "Loading…" : "No orders yet."}</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{o.id}</p>
                    <p className="text-xs text-ink-soft truncate">
                      {o.customer.name || "Customer"} · {formatPKR(o.total)}
                    </p>
                  </div>
                  <StatusBadge status={o.status.toLowerCase()} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Listings */}
        <div className="card-base p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-ink">Recent Listings</h2>
            <Link to="/admin/listings" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              View all →
            </Link>
          </div>
          {data.recentListings.length === 0 ? (
            <p className="text-sm text-ink-soft py-4 text-center">{loading ? "Loading…" : "No listings yet."}</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {data.recentListings.map((l) => (
                <li key={l.key} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{l.title}</p>
                    <p className="text-xs text-ink-soft truncate">
                      {[l.seller, l.location].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <StatusBadge status={l.verified ? "verified" : "unverified"} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Awaiting verification */}
        <div className="card-base p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-ink">Awaiting Verification</h2>
            <Link to="/admin/listings" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Review →
            </Link>
          </div>
          {data.unverified.length === 0 ? (
            <p className="text-sm text-ink-soft py-4 text-center">
              {loading ? "Loading…" : "Nothing pending right now."}
            </p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {data.unverified.map((l) => (
                <li key={l.key} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{l.title}</p>
                    <p className="text-xs text-ink-soft truncate">{l.seller || "—"}</p>
                  </div>
                  <StatusBadge status="unverified" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
