import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { LineChart, BarChart, DonutChart } from "../components/Charts";
import { db, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../store/AuthStore";
import type { Order } from "../../store/OrdersStore";

/**
 * Every chart here is computed from live Supabase counts, read with the signed-in
 * admin's own session (Row Level Security still applies). Per-month figures are
 * "rows created in that calendar month" (using each table's created_at), for
 * the last 6 months. If a query fails its months show as 0 and the reason is
 * listed above the charts, instead of pretending the number is real.
 */

const MONTHS = 6;

const STATUS_META: { status: Order["status"]; color: string }[] = [
  { status: "Placed", color: "#F59E0B" },
  { status: "Confirmed", color: "#8B5CF6" },
  { status: "Shipped", color: "#0EA5E9" },
  { status: "Delivered", color: "#10B981" },
  { status: "Cancelled", color: "#EF4444" },
];

function monthBuckets() {
  const now = new Date();
  return Array.from({ length: MONTHS }, (_, idx) => {
    const i = MONTHS - 1 - idx;
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    return {
      label: start.toLocaleString("en-US", { month: "short" }),
      from: start.toISOString(),
      to: end.toISOString(),
    };
  });
}

interface AnalyticsData {
  labels: string[];
  users: number[];
  orders: number[];
  listings: number[];
  products: number[];
  statusCounts: number[];
  totalOrders: number | null;
}

const empty: AnalyticsData = {
  labels: monthBuckets().map((b) => b.label),
  users: new Array(MONTHS).fill(0),
  orders: new Array(MONTHS).fill(0),
  listings: new Array(MONTHS).fill(0),
  products: new Array(MONTHS).fill(0),
  statusCounts: new Array(STATUS_META.length).fill(0),
  totalOrders: null,
};

export default function AdminAnalytics() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<AnalyticsData>(empty);
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

    async function safe(label: string, run: () => Promise<number>): Promise<number | null> {
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
    const perMonth = (label: string, table: string) =>
      Promise.all(buckets.map((b) => safe(label, () => db.count(table, range(b), token))));

    const [users, orders, usedItems, automobiles, products, statuses, totalOrders] = await Promise.all([
      perMonth("Users", "profiles"),
      perMonth("Orders", "orders"),
      perMonth("Used items", "used_items"),
      perMonth("Automobiles", "automobiles"),
      perMonth("Products", "products"),
      Promise.all(
        STATUS_META.map(({ status }) =>
          safe("Order statuses", () => db.count("orders", `status=eq.${encodeURIComponent(status)}`, token))
        )
      ),
      safe("Total orders", () => db.count("orders", "", token)),
    ]);

    setData({
      labels: buckets.map((b) => b.label),
      users: users.map((n) => n ?? 0),
      orders: orders.map((n) => n ?? 0),
      listings: usedItems.map((n, i) => (n ?? 0) + (automobiles[i] ?? 0)),
      products: products.map((n) => n ?? 0),
      statusCounts: statuses.map((n) => n ?? 0),
      totalOrders,
    });
    setProblems(Array.from(failures));
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isSupabaseConfigured) {
    return (
      <div className="card-base p-6 text-sm text-ink-soft">
        Supabase isn't configured (missing <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>), so
        there is no data to chart.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {problems.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Some data couldn't be loaded (those months show as 0):</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-base p-4">
          <h2 className="font-display font-bold text-ink mb-1">Users growth</h2>
          <p className="text-xs text-ink-soft mb-3">New accounts registered per month, last 6 months</p>
          <LineChart labels={data.labels} series={[{ name: "Users", data: data.users, color: "#E8590C" }]} />
        </div>

        <div className="card-base p-4">
          <h2 className="font-display font-bold text-ink mb-1">Orders</h2>
          <p className="text-xs text-ink-soft mb-3">Orders placed per month, last 6 months</p>
          <LineChart labels={data.labels} series={[{ name: "Orders", data: data.orders, color: "#0EA5E9" }]} />
        </div>

        <div className="card-base p-4">
          <h2 className="font-display font-bold text-ink mb-1">Listings</h2>
          <p className="text-xs text-ink-soft mb-3">Used items + automobile listings created per month</p>
          <BarChart labels={data.labels} data={data.listings} color="#10B981" />
        </div>

        <div className="card-base p-4">
          <h2 className="font-display font-bold text-ink mb-1">Products</h2>
          <p className="text-xs text-ink-soft mb-3">Catalog products created per month</p>
          <BarChart labels={data.labels} data={data.products} color="#8B5CF6" />
        </div>
      </div>

      <div className="card-base p-4">
        <h2 className="font-display font-bold text-ink mb-1">Order status breakdown</h2>
        <p className="text-xs text-ink-soft mb-3">
          {data.totalOrders === null ? "—" : data.totalOrders.toLocaleString()} total orders, grouped by current status
        </p>
        <DonutChart
          segments={STATUS_META.map(({ status, color }, i) => ({
            label: status,
            value: data.statusCounts[i] ?? 0,
            color,
          }))}
          size={200}
        />
      </div>
    </div>
  );
}
