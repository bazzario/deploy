import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "brand" | "blue" | "green" | "amber" | "purple" | "red" | "slate";
  hint?: string;
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  brand: "bg-brand-50 text-brand-600",
  blue: "bg-sky-50 text-sky-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  purple: "bg-violet-50 text-violet-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
};

export default function StatCard({ label, value, icon: Icon, tone = "brand", hint }: StatCardProps) {
  return (
    <div className="card-base p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-soft truncate">{label}</p>
        <p className="font-display text-2xl font-bold text-ink mt-1">{value}</p>
        {hint && <p className="text-[11px] text-ink-soft mt-1">{hint}</p>}
      </div>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${toneClasses[tone]}`}>
        <Icon size={18} />
      </div>
    </div>
  );
}
