import { useMemo, useState } from "react";
import { Tag, Car, Pencil, Trash2, BadgeCheck, RefreshCw } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import TableToolbar, { FilterSelect } from "../components/TableToolbar";
import EditModal, { Field } from "../components/EditModal";
import { useUrlParam } from "../useUrlParam";
import { useProfileNames } from "../useProfileNames";
import { formatPKR } from "../../lib/format";
import { useListings } from "../../store/ListingsStore";
import type { UsedItem, Automobile } from "../../data/types";

type ListingType = "used_item" | "automobile";
type TabValue = "all" | ListingType;

type ListingEntry =
  | { type: "used_item"; item: UsedItem }
  | { type: "automobile"; item: Automobile };

const tabs: { value: TabValue; label: string; icon: typeof Tag }[] = [
  { value: "all", label: "All Listings", icon: Tag },
  { value: "used_item", label: "Used Items", icon: Tag },
  { value: "automobile", label: "Automobiles", icon: Car },
];

const USED_CONDITIONS: UsedItem["condition"][] = ["New", "Like New", "Used - Good", "Used - Fair"];
const AUTO_CONDITIONS: Automobile["condition"][] = ["New", "Used"];

function titleOf(e: ListingEntry) {
  return e.type === "used_item"
    ? e.item.title
    : `${e.item.year} ${e.item.make} ${e.item.model}`.replace(/\s+/g, " ").trim();
}

type Form = Record<string, string>;

function formFor(e: ListingEntry): Form {
  if (e.type === "used_item") {
    const u = e.item;
    return {
      title: u.title,
      price: String(u.price),
      location: u.location,
      condition: u.condition,
      description: u.description,
    };
  }
  const a = e.item;
  return {
    make: a.make,
    model: a.model,
    year: String(a.year),
    price: String(a.price),
    mileageKm: String(a.mileageKm),
    location: a.location,
    condition: a.condition,
  };
}

export default function AdminListings() {
  const {
    usedItems,
    automobiles,
    source,
    loading,
    error,
    refresh,
    updateUsedItem,
    deleteUsedItem,
    updateAutomobile,
    deleteAutomobile,
  } = useListings();
  const names = useProfileNames();
  const canWrite = source === "supabase";

  const [tab, setTab] = useState<TabValue>("all");
  const [search, setSearch] = useUrlParam("q");
  const [status, setStatus] = useUrlParam("verification", "all");
  const [editing, setEditing] = useState<ListingEntry | null>(null);
  const [form, setForm] = useState<Form>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");

  const entries = useMemo<ListingEntry[]>(
    () => [
      ...usedItems.map((item): ListingEntry => ({ type: "used_item", item })),
      ...automobiles.map((item): ListingEntry => ({ type: "automobile", item })),
    ],
    [usedItems, automobiles]
  );

  const sellerOf = (e: ListingEntry) =>
    e.item.seller || (e.item.ownerId ? names.get(e.item.ownerId) ?? "" : "");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const seller = e.item.seller || (e.item.ownerId ? names.get(e.item.ownerId) ?? "" : "");
      const matchesTab = tab === "all" || e.type === tab;
      const matchesSearch = !q || titleOf(e).toLowerCase().includes(q) || seller.toLowerCase().includes(q);
      const verified = Boolean(e.item.verified);
      const matchesStatus = status === "all" || (status === "verified" ? verified : !verified);
      return matchesTab && matchesSearch && matchesStatus;
    });
  }, [entries, names, tab, search, status]);

  function openEdit(e: ListingEntry) {
    setEditing(e);
    setForm(formFor(e));
    setFormError("");
  }

  function closeEdit() {
    setEditing(null);
  }

  async function saveEdit() {
    if (!editing) return;
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return setFormError("Enter a valid price.");

    setSaving(true);
    setFormError("");
    try {
      if (editing.type === "used_item") {
        if (!form.title.trim()) throw new Error("Title is required.");
        await updateUsedItem(editing.item.id, {
          ...editing.item,
          title: form.title.trim(),
          price,
          location: form.location.trim(),
          condition: form.condition as UsedItem["condition"],
          description: form.description.trim(),
        });
      } else {
        const year = Number(form.year);
        const mileageKm = Number(form.mileageKm);
        if (!form.make.trim()) throw new Error("Make is required.");
        if (!Number.isInteger(year) || year < 1900) throw new Error("Enter a valid year.");
        if (!Number.isFinite(mileageKm) || mileageKm < 0) throw new Error("Enter a valid mileage.");
        await updateAutomobile(editing.item.id, {
          ...editing.item,
          make: form.make.trim(),
          model: form.model.trim(),
          year,
          price,
          mileageKm,
          location: form.location.trim(),
          condition: form.condition as Automobile["condition"],
        });
      }
      closeEdit();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the changes.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVerified(e: ListingEntry) {
    setActionError("");
    try {
      if (e.type === "used_item") {
        await updateUsedItem(e.item.id, { ...e.item, verified: !e.item.verified });
      } else {
        await updateAutomobile(e.item.id, { ...e.item, verified: !e.item.verified });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update this listing.");
    }
  }

  async function remove(e: ListingEntry) {
    if (!window.confirm(`Delete "${titleOf(e)}"? This cannot be undone.`)) return;
    setActionError("");
    try {
      if (e.type === "used_item") await deleteUsedItem(e.item.id);
      else await deleteAutomobile(e.item.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete this listing.");
    }
  }

  return (
    <div className="space-y-4">
      {!canWrite && !loading && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {error ?? "The database isn't connected."} Editing and deleting are disabled until listings load from Supabase.
        </div>
      )}
      {actionError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* Type tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === value ? "bg-brand-500 text-white" : "bg-white border border-surface-border text-ink-soft hover:text-ink"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="card-base overflow-hidden">
        <TableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          placeholder="Search by listing or seller..."
          resultCount={filtered.length}
        >
          <FilterSelect
            value={status}
            onChange={setStatus}
            label="Verification"
            options={[
              { value: "verified", label: "Verified" },
              { value: "unverified", label: "Unverified" },
            ]}
          />
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="p-2.5 rounded-lg border border-surface-border text-ink-soft hover:text-ink disabled:opacity-50"
            aria-label="Refresh listings"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </TableToolbar>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-ink-soft uppercase tracking-wide border-b border-surface-border">
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filtered.map((e) => {
                const title = titleOf(e);
                return (
                  <tr key={`${e.type}-${e.item.id}`} className="hover:bg-surface-alt">
                    <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{title}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft">
                        {e.type === "automobile" ? <Car size={13} /> : <Tag size={13} />}
                        {e.type === "automobile" ? "Automobile" : "Used Item"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{sellerOf(e) || "—"}</td>
                    <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{formatPKR(e.item.price)}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{e.item.location || "—"}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{e.item.condition}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.item.verified ? "verified" : "unverified"} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => void toggleVerified(e)}
                          disabled={!canWrite}
                          className={`p-1.5 rounded-md hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed ${
                            e.item.verified ? "text-emerald-600" : "text-ink-soft"
                          }`}
                          aria-label={e.item.verified ? `Remove verification from ${title}` : `Verify ${title}`}
                          title={e.item.verified ? "Remove verified badge" : "Mark as verified"}
                        >
                          <BadgeCheck size={16} />
                        </button>
                        <button
                          onClick={() => openEdit(e)}
                          disabled={!canWrite}
                          className="p-1.5 rounded-md text-ink-soft hover:bg-surface-alt hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Edit ${title}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => void remove(e)}
                          disabled={!canWrite}
                          className="p-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Delete ${title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-ink-soft">
                    Loading listings…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-ink-soft">
                    {entries.length === 0 ? "No listings yet." : "No listings match your search/filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditModal
          title={editing.type === "used_item" ? "Edit used item" : "Edit automobile"}
          onClose={closeEdit}
          onSave={() => void saveEdit()}
          saving={saving}
          error={formError}
        >
          {editing.type === "used_item" ? (
            <>
              <Field label="Title" wide>
                <input className="input-base" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Price (Rs.)">
                <input className="input-base" type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </Field>
              <Field label="Condition">
                <select className="input-base" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                  {USED_CONDITIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Location" wide>
                <input className="input-base" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
              <Field label="Description" wide>
                <textarea className="input-base" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Make">
                <input className="input-base" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
              </Field>
              <Field label="Model">
                <input className="input-base" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </Field>
              <Field label="Year">
                <input className="input-base" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </Field>
              <Field label="Price (Rs.)">
                <input className="input-base" type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </Field>
              <Field label="Mileage (km)">
                <input className="input-base" type="number" min="0" value={form.mileageKm} onChange={(e) => setForm({ ...form, mileageKm: e.target.value })} />
              </Field>
              <Field label="Condition">
                <select className="input-base" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                  {AUTO_CONDITIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Location" wide>
                <input className="input-base" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
            </>
          )}
        </EditModal>
      )}
    </div>
  );
}
