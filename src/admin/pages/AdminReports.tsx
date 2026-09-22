import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Eye, X, RefreshCw } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import TableToolbar, { FilterSelect } from "../components/TableToolbar";
import { useProfileNames } from "../useProfileNames";
import { useUrlParam } from "../useUrlParam";
import { db, isSupabaseConfigured, SupabaseError } from "../../lib/supabase";
import { useAuth } from "../../store/AuthStore";

/**
 * Moderation reports, read from a `public.reports` table.
 *
 * THAT TABLE DOES NOT EXIST in this project's SQL files yet, so on a database
 * without it this page shows a "table missing" message instead of any rows
 * (there is no placeholder data). Once the table exists, View / Resolve /
 * Dismiss work against it through the admin's own session and RLS.
 *
 * Columns this page reads (all optional except id/status/created_at):
 *   id, status ('open' | 'reviewing' | 'resolved' | 'dismissed'), created_at,
 *   reason, details, reporter (text) or reporter_id (uuid -> profiles),
 *   target (text) or target_type + target_id.
 * Resolve / Dismiss need an UPDATE policy for admins on that table.
 */

type Row = Record<string, unknown>;
type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

interface Report {
  id: string;
  reporter: string;
  reporterId: string;
  target: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
}

function reportFromRow(r: Row): Report {
  const target =
    (r.target as string | undefined) ||
    [r.target_type, r.target_id].filter(Boolean).join(": ");
  return {
    id: String(r.id),
    reporter: String(r.reporter ?? ""),
    reporterId: r.reporter_id ? String(r.reporter_id) : "",
    target: String(target ?? ""),
    reason: String(r.reason ?? ""),
    details: String(r.details ?? ""),
    status: String(r.status ?? "open").toLowerCase(),
    createdAt: String(r.created_at ?? ""),
  };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminReports() {
  const { accessToken } = useAuth();
  const names = useProfileNames();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [tableMissing, setTableMissing] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useUrlParam("q");
  const [status, setStatus] = useState("all");
  const [viewing, setViewing] = useState<Report | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setTableMissing(false);
    try {
      const rows = await db.select<Row[]>("reports", "select=*&order=created_at.desc", accessToken ?? undefined);
      setReports((rows ?? []).map(reportFromRow));
    } catch (err) {
      setReports([]);
      // 404 = PostgREST can't find the table (PGRST205 / "relation does not exist").
      const looksMissing = /reports/i.test(err instanceof Error ? err.message : "") && /(find|exist)/i.test(err instanceof Error ? err.message : "");
      if (err instanceof SupabaseError && (err.status === 404 || looksMissing)) {
        setTableMissing(true);
      } else {
        setError(err instanceof Error ? err.message : "Could not load reports.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const reporterOf = useCallback(
    (r: Report) => r.reporter || (r.reporterId ? names.get(r.reporterId) ?? "" : ""),
    [names]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      const matchesSearch =
        !q ||
        r.target.toLowerCase().includes(q) ||
        reporterOf(r).toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q);
      const matchesStatus = status === "all" || r.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [reports, reporterOf, search, status]);

  async function setReportStatus(report: Report, next: ReportStatus) {
    if (report.status === next) return;
    setActionError("");
    setBusyId(report.id);
    try {
      const updated = await db.update<Row[]>(
        "reports",
        `id=eq.${encodeURIComponent(report.id)}`,
        { status: next },
        accessToken ?? undefined
      );
      if (!updated || updated.length === 0) {
        throw new Error("The database did not allow this change (no row was updated). Admins need an UPDATE policy on the reports table.");
      }
      const saved = reportFromRow(updated[0]);
      setReports((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      setViewing((v) => (v && v.id === saved.id ? saved : v));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update this report.");
    } finally {
      setBusyId(null);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="card-base p-6 text-sm text-ink-soft">
        Supabase isn't configured (missing <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>), so
        there are no reports to manage.
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
          placeholder="Search by reporter, target or reason..."
          resultCount={filtered.length}
        >
          <FilterSelect
            value={status}
            onChange={setStatus}
            label="Status"
            options={[
              { value: "open", label: "Open" },
              { value: "reviewing", label: "Reviewing" },
              { value: "resolved", label: "Resolved" },
              { value: "dismissed", label: "Dismissed" },
            ]}
          />
          <button
            onClick={() => void load()}
            disabled={loading}
            className="p-2.5 rounded-lg border border-surface-border text-ink-soft hover:text-ink disabled:opacity-50"
            aria-label="Refresh reports"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </TableToolbar>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-ink-soft uppercase tracking-wide border-b border-surface-border">
                <th className="px-4 py-3">Report</th>
                <th className="px-4 py-3">Reporter</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filtered.map((r) => {
                const busy = busyId === r.id;
                return (
                  <tr key={r.id} className="hover:bg-surface-alt">
                    <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">#{r.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{reporterOf(r) || "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{r.target || "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{r.reason || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewing(r)}
                          className="p-1.5 rounded-md text-ink-soft hover:bg-surface-alt hover:text-ink"
                          aria-label="View details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => void setReportStatus(r, "resolved")}
                          disabled={busy || r.status === "resolved"}
                          className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Resolve report"
                          title="Mark as resolved"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <button
                          onClick={() => void setReportStatus(r, "dismissed")}
                          disabled={busy || r.status === "dismissed"}
                          className="p-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Dismiss report"
                          title="Dismiss report"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-soft">
                    Loading reports…
                  </td>
                </tr>
              )}
              {!loading && tableMissing && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-amber-800">
                    The <code>reports</code> table doesn't exist in your database yet, so there are no reports to show.
                    Reporting isn't set up until that table is created.
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
              {!loading && !tableMissing && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-soft">
                    {reports.length === 0 ? "No reports yet." : "No reports match your search/filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report details modal */}
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
            <p className="font-display font-bold text-ink pr-6">Report #{viewing.id.slice(0, 8).toUpperCase()}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink-soft">
              <StatusBadge status={viewing.status} />
              <span>{formatDate(viewing.createdAt)}</span>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-ink-soft">Reporter</dt>
                <dd className="font-medium text-ink">{reporterOf(viewing) || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Target</dt>
                <dd className="font-medium text-ink break-words">{viewing.target || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Reason</dt>
                <dd className="font-medium text-ink">{viewing.reason || "—"}</dd>
              </div>
              {viewing.details && (
                <div>
                  <dt className="text-xs text-ink-soft">Details</dt>
                  <dd className="text-ink whitespace-pre-wrap">{viewing.details}</dd>
                </div>
              )}
            </dl>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => void setReportStatus(viewing, "reviewing")}
                disabled={busyId === viewing.id || viewing.status === "reviewing"}
                className="btn-secondary !py-2 !px-4 text-sm disabled:opacity-50"
              >
                Mark reviewing
              </button>
              <button
                onClick={() => void setReportStatus(viewing, "dismissed")}
                disabled={busyId === viewing.id || viewing.status === "dismissed"}
                className="btn-secondary !py-2 !px-4 text-sm disabled:opacity-50"
              >
                Dismiss
              </button>
              <button
                onClick={() => void setReportStatus(viewing, "resolved")}
                disabled={busyId === viewing.id || viewing.status === "resolved"}
                className="btn-primary !py-2 !px-4 text-sm disabled:opacity-50"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
