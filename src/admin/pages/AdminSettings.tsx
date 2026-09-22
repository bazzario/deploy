import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Globe, ShieldCheck, Users2 } from "lucide-react";
import { db, isSupabaseConfigured, SupabaseError } from "../../lib/supabase";
import { useAuth, validateEmail } from "../../store/AuthStore";
import { site } from "../../config/site";

/**
 * Platform settings, stored in ONE row of a `public.platform_settings` table.
 *
 * THAT TABLE DOES NOT EXIST in this project's SQL files yet. Without it every
 * control on this page is disabled and a notice says so — nothing is saved
 * locally or pretended. Once the table exists the page loads the first row
 * and "Save changes" updates it (or inserts it if the table is still empty),
 * through the admin's own session and RLS.
 *
 * Columns this page reads/writes:
 *   id, site_name text, support_email text, maintenance_mode bool,
 *   auto_approve_listings bool, require_seller_verification bool,
 *   email_notifications bool, sms_notifications bool
 * Admins need SELECT, INSERT and UPDATE policies on it.
 *
 * Note: saving stores the values only. Nothing in the storefront reads these
 * settings yet (e.g. maintenance mode does not take the shop offline).
 */

const TABLE = "platform_settings";

interface SettingsForm {
  siteName: string;
  supportEmail: string;
  maintenanceMode: boolean;
  autoApproveListings: boolean;
  requireSellerVerification: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

// Name and support email come from the site's real config; switches start off.
const initialForm: SettingsForm = {
  siteName: site.name,
  supportEmail: site.supportEmail,
  maintenanceMode: false,
  autoApproveListings: false,
  requireSellerVerification: false,
  emailNotifications: false,
  smsNotifications: false,
};

type Row = Record<string, unknown>;

function formFromRow(r: Row): SettingsForm {
  return {
    siteName: String(r.site_name ?? initialForm.siteName),
    supportEmail: String(r.support_email ?? initialForm.supportEmail),
    maintenanceMode: r.maintenance_mode === true,
    autoApproveListings: r.auto_approve_listings === true,
    requireSellerVerification: r.require_seller_verification === true,
    emailNotifications: r.email_notifications === true,
    smsNotifications: r.sms_notifications === true,
  };
}

function rowFromForm(f: SettingsForm): Row {
  return {
    site_name: f.siteName.trim(),
    support_email: f.supportEmail.trim(),
    maintenance_mode: f.maintenanceMode,
    auto_approve_listings: f.autoApproveListings,
    require_seller_verification: f.requireSellerVerification,
    email_notifications: f.emailNotifications,
    sms_notifications: f.smsNotifications,
  };
}

export default function AdminSettings() {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [tableMissing, setTableMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setTableMissing(false);
    try {
      const rows = await db.select<Row[]>(TABLE, "select=*&limit=1", accessToken ?? undefined);
      if (rows && rows.length > 0) {
        setRowId(String(rows[0].id));
        setForm(formFromRow(rows[0]));
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "";
      const looksMissing = /platform_settings/i.test(text) && /(find|exist)/i.test(text);
      if (err instanceof SupabaseError && (err.status === 404 || looksMissing)) {
        setTableMissing(true);
      } else {
        setError(text || "Could not load settings.");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const locked = !isSupabaseConfigured || loading || tableMissing;

  function update<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setMessage("");
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setError("");
    setMessage("");
    if (!form.siteName.trim()) return setError("Site name is required.");
    if (!validateEmail(form.supportEmail)) return setError("Enter a valid support email address.");

    setSaving(true);
    try {
      const token = accessToken ?? undefined;
      if (rowId) {
        const updated = await db.update<Row[]>(TABLE, `id=eq.${encodeURIComponent(rowId)}`, rowFromForm(form), token);
        if (!updated || updated.length === 0) {
          throw new Error("The database did not allow this change (no row was updated). Admins need an UPDATE policy on platform_settings.");
        }
        setForm(formFromRow(updated[0]));
      } else {
        const inserted = await db.insert<Row[]>(TABLE, rowFromForm(form), token);
        if (!inserted || inserted.length === 0) {
          throw new Error("The settings could not be saved. Admins need an INSERT policy on platform_settings.");
        }
        setRowId(String(inserted[0].id));
        setForm(formFromRow(inserted[0]));
      }
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {!isSupabaseConfigured && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Supabase isn't configured (missing <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>), so
          settings can't be loaded or saved.
        </div>
      )}
      {tableMissing && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          The <code>platform_settings</code> table doesn't exist in your database yet, so these settings can't be
          loaded or saved. The controls are disabled until it is created.
        </div>
      )}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">{message}</div>
      )}

      <section className="card-base p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={18} className="text-brand-600" />
          <h2 className="font-display font-bold text-ink">General</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-ink-soft mb-1 block">Site name</label>
            <input
              value={form.siteName}
              onChange={(e) => update("siteName", e.target.value)}
              disabled={locked}
              className="input-base disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft mb-1 block">Support email</label>
            <input
              type="email"
              value={form.supportEmail}
              onChange={(e) => update("supportEmail", e.target.value)}
              disabled={locked}
              className="input-base disabled:opacity-60"
            />
          </div>
          <ToggleRow
            label="Maintenance mode"
            hint="Show a maintenance page to shoppers while you make changes."
            checked={form.maintenanceMode}
            onChange={(v) => update("maintenanceMode", v)}
            disabled={locked}
          />
        </div>
      </section>

      <section className="card-base p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users2 size={18} className="text-brand-600" />
          <h2 className="font-display font-bold text-ink">Listings & Sellers</h2>
        </div>
        <div className="space-y-3">
          <ToggleRow
            label="Auto-approve new listings"
            hint="Skip manual review for used items and automobiles."
            checked={form.autoApproveListings}
            onChange={(v) => update("autoApproveListings", v)}
            disabled={locked}
          />
          <ToggleRow
            label="Require seller verification"
            hint="Sellers must be verified before publishing listings."
            checked={form.requireSellerVerification}
            onChange={(v) => update("requireSellerVerification", v)}
            disabled={locked}
          />
        </div>
      </section>

      <section className="card-base p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={18} className="text-brand-600" />
          <h2 className="font-display font-bold text-ink">Notifications</h2>
        </div>
        <div className="space-y-3">
          <ToggleRow
            label="Email notifications"
            hint="Get emailed for new reports and pending approvals."
            checked={form.emailNotifications}
            onChange={(v) => update("emailNotifications", v)}
            disabled={locked}
          />
          <ToggleRow
            label="SMS notifications"
            hint="Get a text for urgent moderation reports."
            checked={form.smsNotifications}
            onChange={(v) => update("smsNotifications", v)}
            disabled={locked}
          />
        </div>
      </section>

      <section className="card-base p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={18} className="text-brand-600" />
          <h2 className="font-display font-bold text-ink">Admin access</h2>
        </div>
        <p className="text-sm text-ink-soft">
          Admin roles are managed on the Users page: grant or remove admin access, and block or unblock accounts.
        </p>
        <Link to="/admin/users" className="inline-block mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
          Manage users →
        </Link>
      </section>

      <div className="flex justify-end">
        <button onClick={() => void handleSave()} disabled={locked || saving} className="btn-primary disabled:opacity-60">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-soft mt-0.5">{hint}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? "bg-brand-500" : "bg-surface-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
