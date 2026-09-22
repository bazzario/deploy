import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Ban, CheckCircle2, ShieldPlus, ShieldOff, X, RefreshCw } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import TableToolbar, { FilterSelect } from "../components/TableToolbar";
import { useUrlParam } from "../useUrlParam";
import { db, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../store/AuthStore";
import { useListings } from "../../store/ListingsStore";

interface ProfileRecord {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isBlocked: boolean;
  createdAt: string;
}

type Row = Record<string, unknown>;

const PROFILE_COLUMNS = "id,email,full_name,is_admin,is_blocked,created_at";

function profileFromRow(r: Row): ProfileRecord {
  return {
    id: String(r.id),
    email: String(r.email ?? ""),
    name: String(r.full_name ?? "").trim(),
    isAdmin: r.is_admin === true,
    isBlocked: r.is_blocked === true,
    createdAt: String(r.created_at ?? ""),
  };
}

function displayName(u: ProfileRecord) {
  return u.name || u.email || "Unnamed user";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminUsers() {
  const { user: me, accessToken } = useAuth();
  const { products, usedItems, automobiles } = useListings();

  const [users, setUsers] = useState<ProfileRecord[]>([]);
  const [orderCounts, setOrderCounts] = useState<Map<string, number> | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useUrlParam("q");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [viewing, setViewing] = useState<ProfileRecord | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const rows = await db.select<Row[]>(
        "profiles",
        `select=${PROFILE_COLUMNS}&order=created_at.desc`,
        accessToken ?? undefined
      );
      setUsers((rows ?? []).map(profileFromRow));
    } catch (err) {
      setUsers([]);
      setError(
        err instanceof Error
          ? `${err.message}; make sure supabase/admin-setup.sql has been run in your Supabase project.`
          : "Could not load users."
      );
    } finally {
      setLoading(false);
    }

    // Order counts are a nice-to-have; if the read fails we just show "—".
    try {
      const orderRows = await db.select<Row[]>("orders", "select=buyer_id", accessToken ?? undefined);
      const counts = new Map<string, number>();
      for (const o of orderRows ?? []) {
        if (o.buyer_id) counts.set(String(o.buyer_id), (counts.get(String(o.buyer_id)) ?? 0) + 1);
      }
      setOrderCounts(counts);
    } catch {
      setOrderCounts(null);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const listingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of [...products, ...usedItems, ...automobiles]) {
      if (l.ownerId) counts.set(l.ownerId, (counts.get(l.ownerId) ?? 0) + 1);
    }
    return counts;
  }, [products, usedItems, automobiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchesRole = role === "all" || (role === "admin" ? u.isAdmin : !u.isAdmin);
      const matchesStatus = status === "all" || (status === "blocked" ? u.isBlocked : !u.isBlocked);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, role, status]);

  /** PATCH one profile. RLS ("profiles: admin update") decides if it is allowed. */
  async function patchProfile(target: ProfileRecord, patch: { is_blocked?: boolean; is_admin?: boolean }) {
    setActionError("");
    setBusyId(target.id);
    try {
      const updated = await db.update<Row[]>(
        "profiles",
        `id=eq.${encodeURIComponent(target.id)}`,
        patch,
        accessToken ?? undefined
      );
      if (!updated || updated.length === 0) {
        throw new Error("The database did not allow this change (no row was updated).");
      }
      const next = profileFromRow(updated[0]);
      setUsers((prev) => prev.map((u) => (u.id === next.id ? next : u)));
      setViewing((v) => (v && v.id === next.id ? next : v));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update this user.");
    } finally {
      setBusyId(null);
    }
  }

  function toggleBlock(u: ProfileRecord) {
    const verb = u.isBlocked ? "Unblock" : "Block";
    if (!window.confirm(`${verb} ${displayName(u)}?`)) return;
    void patchProfile(u, { is_blocked: !u.isBlocked });
  }

  function toggleAdmin(u: ProfileRecord) {
    const verb = u.isAdmin ? "Remove admin access from" : "Give admin access to";
    if (!window.confirm(`${verb} ${displayName(u)}?`)) return;
    void patchProfile(u, { is_admin: !u.isAdmin });
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="card-base p-6 text-sm text-ink-soft">
        Supabase isn't configured (missing <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>), so
        there are no users to manage.
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
          placeholder="Search by name or email..."
          resultCount={filtered.length}
        >
          <FilterSelect
            value={role}
            onChange={setRole}
            label="Role"
            options={[
              { value: "admin", label: "Admin" },
              { value: "user", label: "User" },
            ]}
          />
          <FilterSelect
            value={status}
            onChange={setStatus}
            label="Status"
            options={[
              { value: "active", label: "Active" },
              { value: "blocked", label: "Blocked" },
            ]}
          />
          <button
            onClick={() => void load()}
            disabled={loading}
            className="p-2.5 rounded-lg border border-surface-border text-ink-soft hover:text-ink disabled:opacity-50"
            aria-label="Refresh users"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </TableToolbar>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-ink-soft uppercase tracking-wide border-b border-surface-border">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-center">Listings</th>
                <th className="px-4 py-3 text-center">Orders</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filtered.map((u) => {
                const isSelf = u.id === me?.id;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className="hover:bg-surface-alt">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {displayName(u).charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-ink whitespace-nowrap">
                          {displayName(u)}
                          {isSelf && <span className="ml-1.5 text-[10px] font-semibold text-ink-soft">(you)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{u.email || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.isAdmin ? "admin" : "user"} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.isBlocked ? "blocked" : "active"} />
                    </td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-center text-ink-soft">{listingCounts.get(u.id) ?? 0}</td>
                    <td className="px-4 py-3 text-center text-ink-soft">
                      {orderCounts ? orderCounts.get(u.id) ?? 0 : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewing(u)}
                          className="p-1.5 rounded-md text-ink-soft hover:bg-surface-alt hover:text-ink"
                          aria-label={`View ${displayName(u)}`}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => toggleAdmin(u)}
                          disabled={isSelf || busy}
                          className="p-1.5 rounded-md text-violet-600 hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={u.isAdmin ? `Remove admin from ${displayName(u)}` : `Make ${displayName(u)} admin`}
                          title={isSelf ? "You can't change your own admin access" : u.isAdmin ? "Remove admin access" : "Give admin access"}
                        >
                          {u.isAdmin ? <ShieldOff size={16} /> : <ShieldPlus size={16} />}
                        </button>
                        <button
                          onClick={() => toggleBlock(u)}
                          disabled={isSelf || busy}
                          className={`p-1.5 rounded-md hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed ${
                            u.isBlocked ? "text-emerald-600" : "text-red-600"
                          }`}
                          aria-label={u.isBlocked ? `Unblock ${displayName(u)}` : `Block ${displayName(u)}`}
                          title={isSelf ? "You can't block yourself" : u.isBlocked ? "Unblock user" : "Block user"}
                        >
                          {u.isBlocked ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-ink-soft">
                    Loading users…
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
                    {users.length === 0 ? "No users found." : "No users match your search/filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View user modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewing(null)} />
          <div className="relative w-full max-w-sm card-base p-5">
            <button
              onClick={() => setViewing(null)}
              className="absolute top-3 right-3 text-ink-soft hover:text-ink"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                {displayName(viewing).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-ink truncate">{displayName(viewing)}</p>
                <p className="text-xs text-ink-soft truncate">{viewing.email || "No email"}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-soft">Role</dt>
                <dd className="mt-0.5"><StatusBadge status={viewing.isAdmin ? "admin" : "user"} /></dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Status</dt>
                <dd className="mt-0.5"><StatusBadge status={viewing.isBlocked ? "blocked" : "active"} /></dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Joined</dt>
                <dd className="font-medium text-ink">{formatDate(viewing.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Listings</dt>
                <dd className="font-medium text-ink">{listingCounts.get(viewing.id) ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Orders</dt>
                <dd className="font-medium text-ink">{orderCounts ? orderCounts.get(viewing.id) ?? 0 : "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-ink-soft">User ID</dt>
                <dd className="font-mono text-[11px] text-ink break-all">{viewing.id}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
