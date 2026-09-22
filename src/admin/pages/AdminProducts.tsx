import { useMemo, useState } from "react";
import { Pencil, Trash2, RefreshCw } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import TableToolbar, { FilterSelect } from "../components/TableToolbar";
import EditModal, { Field } from "../components/EditModal";
import { useUrlParam } from "../useUrlParam";
import { useProfileNames } from "../useProfileNames";
import { formatPKR } from "../../lib/format";
import { primaryImage } from "../../lib/productImages";
import { useListings } from "../../store/ListingsStore";
import type { Product } from "../../data/types";

interface ProductForm {
  title: string;
  brand: string;
  category: string;
  price: string;
  originalPrice: string;
  stock: string;
}

function toForm(p: Product): ProductForm {
  return {
    title: p.title,
    brand: p.brand,
    category: p.category,
    price: String(p.price),
    originalPrice: p.originalPrice === undefined ? "" : String(p.originalPrice),
    stock: p.stock === undefined ? "" : String(p.stock),
  };
}

function productStatus(p: Product) {
  return p.stock !== undefined && p.stock <= 0 ? "out_of_stock" : "active";
}

export default function AdminProducts() {
  const { products, source, loading, error, refresh, updateProduct, deleteProduct } = useListings();
  const names = useProfileNames();
  const canWrite = source === "supabase";

  const [search, setSearch] = useUrlParam("q");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.category).filter(Boolean)))
        .sort()
        .map((c) => ({ value: c, label: c })),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const seller = p.ownerId ? names.get(p.ownerId) ?? "" : "";
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        seller.toLowerCase().includes(q);
      const matchesCategory = category === "all" || p.category === category;
      const matchesStatus = status === "all" || productStatus(p) === status;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, names, search, category, status]);

  function openEdit(p: Product) {
    setEditing(p);
    setForm(toForm(p));
    setFormError("");
  }

  function closeEdit() {
    setEditing(null);
    setForm(null);
  }

  async function saveEdit() {
    if (!editing || !form) return;
    const price = Number(form.price);
    const originalPrice = form.originalPrice.trim() === "" ? undefined : Number(form.originalPrice);
    const stock = form.stock.trim() === "" ? undefined : Number(form.stock);
    if (!form.title.trim()) return setFormError("Title is required.");
    if (!Number.isFinite(price) || price < 0) return setFormError("Enter a valid price.");
    if (originalPrice !== undefined && (!Number.isFinite(originalPrice) || originalPrice < 0))
      return setFormError("Enter a valid original price, or leave it empty.");
    if (stock !== undefined && (!Number.isInteger(stock) || stock < 0))
      return setFormError("Stock must be a whole number, or empty if not tracked.");

    setSaving(true);
    setFormError("");
    try {
      await updateProduct(editing.id, {
        ...editing,
        title: form.title.trim(),
        brand: form.brand.trim(),
        category: form.category.trim(),
        price,
        originalPrice,
        stock,
      });
      closeEdit();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the changes.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(p: Product) {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    setActionError("");
    try {
      await deleteProduct(p.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete this product.");
    }
  }

  return (
    <div className="space-y-4">
      {!canWrite && !loading && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {error ?? "The database isn't connected."} Editing and deleting are disabled until products load from Supabase.
        </div>
      )}
      {actionError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      <div className="card-base overflow-hidden">
        <TableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          placeholder="Search by product, brand or seller..."
          resultCount={filtered.length}
        >
          <FilterSelect value={category} onChange={setCategory} label="Category" options={categoryOptions} />
          <FilterSelect
            value={status}
            onChange={setStatus}
            label="Stock"
            options={[
              { value: "active", label: "Available" },
              { value: "out_of_stock", label: "Out of Stock" },
            ]}
          />
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="p-2.5 rounded-lg border border-surface-border text-ink-soft hover:text-ink disabled:opacity-50"
            aria-label="Refresh products"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </TableToolbar>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-ink-soft uppercase tracking-wide border-b border-surface-border">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-center">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-surface-alt">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {primaryImage(p) ? (
                        <img
                          src={primaryImage(p)}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover bg-surface-alt border border-surface-border flex-shrink-0"
                        />
                      ) : (
                        <span className="w-9 h-9 rounded-lg bg-surface-alt border border-surface-border flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-ink whitespace-nowrap">{p.title}</p>
                        {p.brand && <p className="text-xs text-ink-soft">{p.brand}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft whitespace-nowrap">
                    {p.ownerId ? names.get(p.ownerId) || "—" : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{formatPKR(p.price)}</td>
                  <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{p.category || "—"}</td>
                  <td className="px-4 py-3 text-center text-ink-soft">{p.stock === undefined ? "—" : p.stock}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={productStatus(p)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEdit(p)}
                        disabled={!canWrite}
                        className="p-1.5 rounded-md text-ink-soft hover:bg-surface-alt hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={`Edit ${p.title}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => void removeProduct(p)}
                        disabled={!canWrite}
                        className="p-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={`Delete ${p.title}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-soft">
                    Loading products…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-soft">
                    {products.length === 0 ? "No products yet." : "No products match your search/filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && form && (
        <EditModal
          title="Edit product"
          onClose={closeEdit}
          onSave={() => void saveEdit()}
          saving={saving}
          error={formError}
        >
          <Field label="Title" wide>
            <input className="input-base" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Brand">
            <input className="input-base" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </Field>
          <Field label="Category">
            <input className="input-base" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Price (Rs.)">
            <input className="input-base" type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Original price (optional)">
            <input className="input-base" type="number" min="0" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
          </Field>
          <Field label="Stock (empty = not tracked)" wide>
            <input className="input-base" type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </Field>
        </EditModal>
      )}
    </div>
  );
}
