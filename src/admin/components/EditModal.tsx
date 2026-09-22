import type { ReactNode } from "react";
import { X } from "lucide-react";

/** Small shared modal used by the admin edit forms. */
export default function EditModal({
  title,
  onClose,
  onSave,
  saving,
  error,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto card-base p-5">
        <button
          onClick={onClose}
          disabled={saving}
          className="absolute top-3 right-3 text-ink-soft hover:text-ink"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <h2 className="font-display font-bold text-ink pr-6">{title}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">{children}</div>
        {error && (
          <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="btn-secondary !py-2 !px-4 text-sm">
            Cancel
          </button>
          <button onClick={onSave} disabled={saving} className="btn-primary !py-2 !px-4 text-sm">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "col-span-2" : ""}`}>
      <span className="block text-xs font-medium text-ink-soft mb-1">{label}</span>
      {children}
    </label>
  );
}
