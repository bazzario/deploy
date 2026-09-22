import { Search } from "lucide-react";
import type { ReactNode } from "react";

interface TableToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode; // filter <select> elements etc.
  resultCount?: number;
}

export default function TableToolbar({
  searchValue,
  onSearchChange,
  placeholder = "Search...",
  children,
  resultCount,
}: TableToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border-b border-surface-border">
      <div className="relative w-full sm:max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="input-base !pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {typeof resultCount === "number" && (
          <span className="text-xs text-ink-soft whitespace-nowrap">{resultCount} results</span>
        )}
      </div>
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="rounded-lg border border-surface-border bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
    >
      <option value="all">{label}: All</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
