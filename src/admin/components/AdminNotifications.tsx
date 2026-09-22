import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, RefreshCw } from "lucide-react";
import { db, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../store/AuthStore";

/**
 * Header bell. It shows only things that are really pending in the database
 * (read with the admin's own session, so RLS still applies):
 *   - orders whose status is still "Placed" (not yet confirmed)
 *   - used items + automobiles that are not verified yet
 * The red dot appears only when at least one of those counts is above zero.
 * Nothing is invented: if a count can't be read it says so.
 */

interface Pending {
  placedOrders: number | null;
  unverifiedListings: number | null;
}

export default function AdminNotifications() {
  const { accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const token = accessToken ?? undefined;
    const safe = async (run: () => Promise<number>) => {
      try {
        return await run();
      } catch {
        return null;
      }
    };
    const [placedOrders, unverifiedUsed, unverifiedAutos] = await Promise.all([
      safe(() => db.count("orders", "status=eq.Placed", token)),
      safe(() => db.count("used_items", "verified=eq.false", token)),
      safe(() => db.count("automobiles", "verified=eq.false", token)),
    ]);
    setPending({
      placedOrders,
      unverifiedListings:
        unverifiedUsed === null || unverifiedAutos === null ? null : unverifiedUsed + unverifiedAutos,
    });
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = (pending?.placedOrders ?? 0) + (pending?.unverifiedListings ?? 0);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void load(); // always show fresh numbers when the panel opens
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative text-ink-soft hover:text-ink"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={19} />
        {total > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-500" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-3 w-72 max-w-[85vw] card-base p-3 z-50">
            <div className="flex items-center justify-between mb-2">
              <p className="font-display font-bold text-sm text-ink">Needs attention</p>
              <button
                onClick={() => void load()}
                disabled={loading}
                className="text-ink-soft hover:text-ink disabled:opacity-50"
                aria-label="Refresh notifications"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {!isSupabaseConfigured ? (
              <p className="text-xs text-ink-soft py-2">Supabase isn't configured.</p>
            ) : !pending ? (
              <p className="text-xs text-ink-soft py-2">Loading…</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                <NotificationRow
                  count={pending.placedOrders}
                  to="/admin/orders?status=Placed"
                  onClick={() => setOpen(false)}
                  label={(n) => `${n} new order${n === 1 ? "" : "s"} waiting to be confirmed`}
                />
                <NotificationRow
                  count={pending.unverifiedListings}
                  to="/admin/listings?verification=unverified"
                  onClick={() => setOpen(false)}
                  label={(n) => `${n} listing${n === 1 ? "" : "s"} awaiting verification`}
                />
              </ul>
            )}

            {pending && total === 0 && pending.placedOrders !== null && pending.unverifiedListings !== null && (
              <p className="text-xs text-ink-soft py-2">Nothing needs your attention right now.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NotificationRow({
  count,
  to,
  label,
  onClick,
}: {
  count: number | null;
  to: string;
  label: (n: number) => string;
  onClick: () => void;
}) {
  if (count === null) {
    return <li className="py-2 text-xs text-red-700">Couldn't load this count.</li>;
  }
  if (count === 0) return null;
  return (
    <li>
      <Link to={to} onClick={onClick} className="block py-2 text-sm text-ink hover:text-brand-600">
        {label(count)} <span aria-hidden="true">→</span>
      </Link>
    </li>
  );
}
