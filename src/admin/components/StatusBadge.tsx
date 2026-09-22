/**
 * Renders a small pill for any status string used across the admin tables
 * (user status, product status, listing status, order status, report status).
 * Add new keys here as new statuses are introduced — unknown strings fall
 * back to a neutral grey pill so nothing ever throws.
 */
const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",

  confirmed: "bg-sky-50 text-sky-700 border-sky-200",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unverified: "bg-slate-100 text-slate-600 border-slate-200",
  admin: "bg-violet-50 text-violet-700 border-violet-200",
  user: "bg-slate-100 text-slate-600 border-slate-200",

  placed: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-amber-50 text-amber-700 border-amber-200",
  reviewing: "bg-amber-50 text-amber-700 border-amber-200",
  open: "bg-amber-50 text-amber-700 border-amber-200",

  shipped: "bg-sky-50 text-sky-700 border-sky-200",
  in_transit: "bg-violet-50 text-violet-700 border-violet-200",
  out_for_delivery: "bg-indigo-50 text-indigo-700 border-indigo-200",

  blocked: "bg-red-50 text-red-700 border-red-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  dismissed: "bg-slate-100 text-slate-600 border-slate-200",

  sold: "bg-slate-100 text-slate-600 border-slate-200",
  out_of_stock: "bg-slate-100 text-slate-600 border-slate-200",
};

function toLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function StatusBadge({ status }: { status: string }) {
  const classes = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${classes}`}>
      {toLabel(status)}
    </span>
  );
}
