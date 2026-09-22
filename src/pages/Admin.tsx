import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, X, Package, Tag, Car, RotateCcw, Lock, LogOut, AlertTriangle } from "lucide-react";
import { useListings } from "../store/ListingsStore";
import { useAuth } from "../store/AuthStore";
import { formatPKR } from "../lib/format";
import type { Product, UsedItem, Automobile } from "../data/types";

/**
 * Admin access ab frontend ke kisi PIN se control NAHI hota.
 *
 * Asli check server par hota hai: user Supabase se sign in karta hai, aur
 * uske `profiles.is_admin` flag ko Row Level Security policies enforce karti
 * hain. Yahan ka check sirf UI hide karne ke liye hai — agar koi bypass bhi
 * kar le, database usay likhne nahi dega (supabase/schema.sql dekhein).
 */
function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, backendConnected } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-ink-soft">Checking access…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xs card-base p-6 text-center">
          <div className="w-11 h-11 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mx-auto">
            <Lock size={20} />
          </div>
          <h1 className="font-display font-bold text-lg text-ink mt-3">Admin Access</h1>
          <p className="text-xs text-ink-soft mt-1">
            Sign in with an admin account to manage listings.
          </p>
          <Link to="/auth?mode=login&next=/admin" className="btn-primary w-full mt-4">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm card-base p-6 text-center">
          <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center text-red-600 mx-auto">
            <Lock size={20} />
          </div>
          <h1 className="font-display font-bold text-lg text-ink mt-3">Access denied</h1>
          <p className="text-xs text-ink-soft mt-1">
            Your account ({user.email}) doesn't have admin permissions.
          </p>
          <Link to="/" className="btn-primary w-full mt-4">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {!backendConnected && (
        <div className="container-page pt-4">
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Development mode.</strong> The backend isn't connected, so the admin check is
              limited to this browser and listings are only saved on this device. Set up Supabase
              before launching publicly (see README).
            </p>
          </div>
        </div>
      )}
      {children}
      <div className="container-page pb-6">
        <button onClick={() => void signOut()} className="btn-secondary !py-2 !px-3 text-xs">
          <LogOut size={14} /> Sign out of admin
        </button>
      </div>
    </>
  );
}

type Tab = "products" | "used" | "automobiles";

const emptyProduct: Omit<Product, "id"> = {
  title: "",
  brand: "",
  category: "electronics",
  price: 0,
  originalPrice: undefined,
  rating: 4.5,
  reviews: 0,
  image: "",
  badge: undefined,
  freeDelivery: false,
  stock: 10,
};

const emptyUsedItem: Omit<UsedItem, "id"> = {
  title: "",
  price: 0,
  negotiable: true,
  condition: "Used - Good",
  location: "",
  seller: "",
  sellerRating: 4.5,
  postedAgo: "Just now",
  image: "",
  category: "Electronics",
  description: "",
  phone: "",
  verified: false,
};

const emptyAuto: Omit<Automobile, "id"> = {
  make: "",
  model: "",
  year: new Date().getFullYear(),
  price: 0,
  mileageKm: 0,
  fuel: "Petrol",
  transmission: "Manual",
  location: "",
  condition: "Used",
  type: "Car",
  image: "",
  seller: "",
  postedAgo: "Just now",
  phone: "",
  verified: false,
};

export default function Admin() {
  const [tab, setTab] = useState<Tab>("products");
  const listings = useListings();

  return (
    <AdminGate>
    <div className="container-page py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-ink">Admin Panel</h1>
          <p className="text-sm text-ink-soft mt-1">
            {listings.source === "supabase"
              ? "Add, edit or remove listings. Changes appear for all visitors instantly."
              : "Add, edit or remove listings. Changes are only saved in this browser."}
          </p>
        </div>
        {listings.source === "local" && (
          <button
            onClick={() => {
              if (confirm("Reset all listings back to the original sample data? This cannot be undone.")) {
                listings.resetToDefaults();
              }
            }}
            className="btn-secondary !py-2 !px-3 text-xs flex-shrink-0 self-start"
          >
            <RotateCcw size={14} /> Reset sample data
          </button>
        )}
      </div>

      {listings.error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-4">
          {listings.error}
        </p>
      )}

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mt-5 mb-6 border-b border-surface-border">
        <TabButton active={tab === "products"} onClick={() => setTab("products")} icon={Package}>
          Products ({listings.products.length})
        </TabButton>
        <TabButton active={tab === "used"} onClick={() => setTab("used")} icon={Tag}>
          Used Products ({listings.usedItems.length})
        </TabButton>
        <TabButton active={tab === "automobiles"} onClick={() => setTab("automobiles")} icon={Car}>
          Automobiles ({listings.automobiles.length})
        </TabButton>
      </div>

      {tab === "products" && <ProductsPanel />}
      {tab === "used" && <UsedItemsPanel />}
      {tab === "automobiles" && <AutomobilesPanel />}
    </div>
    </AdminGate>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Package;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold border-b-2 flex-shrink-0 whitespace-nowrap ${
        active ? "border-brand-500 text-brand-600" : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      <Icon size={15} /> {children}
    </button>
  );
}

/* ---------------- Products ---------------- */

function ProductsPanel() {
  const { products, addProduct, updateProduct, deleteProduct } = useListings();
  const { user } = useAuth();
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Product, "id">>(emptyProduct);

  function openAdd() {
    setEditing(null);
    setForm(emptyProduct);
    setShowForm(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setForm(p);
    setShowForm(true);
  }
  async function submit() {
    if (!form.title.trim() || !form.image.trim()) {
      alert("Title and image URL are required.");
      return;
    }
    try {
      if (editing) await updateProduct(editing.id, form);
      else await addProduct({ ...form, ownerId: form.ownerId ?? user?.id });
      setShowForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save the changes.");
    }
  }

  return (
    <div>
      <button onClick={openAdd} className="btn-primary text-sm mb-4">
        <Plus size={16} /> Add Product
      </button>

      <div className="flex flex-col gap-2">
        {products.map((p) => (
          <div key={p.id} className="card-base flex items-center gap-3 p-3">
            <img src={p.image} alt={p.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-surface-alt" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{p.title}</p>
              <p className="text-xs text-ink-soft">{p.brand} &middot; {formatPKR(p.price)}</p>
            </div>
            <button onClick={() => openEdit(p)} className="p-2 text-ink-soft hover:text-brand-600" aria-label="Edit"><Pencil size={16} /></button>
            <button onClick={() => {
              if (confirm("Delete this product?")) {
                deleteProduct(p.id).catch((err: unknown) =>
                  alert(err instanceof Error ? err.message : "Could not delete the listing.")
                );
              }
            }} className="p-2 text-ink-soft hover:text-red-600" aria-label="Delete"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>

      {showForm && (
        <FormModal title={editing ? "Edit Product" : "Add Product"} onClose={() => setShowForm(false)} onSubmit={submit}>
          <TextField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <TextField label="Brand" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
            <SelectField
              label="Badge"
              value={form.badge ?? ""}
              options={["", "New", "Bestseller", "Limited"]}
              onChange={(v) => setForm({ ...form, badge: (v || undefined) as Product["badge"] })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Price (Rs.)" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
            <NumberField label="Original Price (optional)" value={form.originalPrice ?? 0} onChange={(v) => setForm({ ...form, originalPrice: v || undefined })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Rating (0 to 5)" value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} step="0.1" />
            <NumberField label="Reviews count" value={form.reviews} onChange={(v) => setForm({ ...form, reviews: v })} />
          </div>
          <TextField label="Image URL" value={form.image} onChange={(v) => setForm({ ...form, image: v })} />
          <NumberField
            label="Stock (units available)"
            value={form.stock ?? 0}
            onChange={(v) => setForm({ ...form, stock: v })}
          />
          <CheckField label="Free delivery" checked={!!form.freeDelivery} onChange={(v) => setForm({ ...form, freeDelivery: v })} />
        </FormModal>
      )}
    </div>
  );
}

/* ---------------- Used Products ---------------- */

function UsedItemsPanel() {
  const { usedItems, addUsedItem, updateUsedItem, deleteUsedItem } = useListings();
  const { user } = useAuth();
  const [editing, setEditing] = useState<UsedItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<UsedItem, "id">>(emptyUsedItem);

  function openAdd() {
    setEditing(null);
    setForm(emptyUsedItem);
    setShowForm(true);
  }
  function openEdit(item: UsedItem) {
    setEditing(item);
    setForm(item);
    setShowForm(true);
  }
  async function submit() {
    if (!form.title.trim() || !form.image.trim()) {
      alert("Title and image URL are required.");
      return;
    }
    try {
      if (editing) await updateUsedItem(editing.id, form);
      else await addUsedItem({ ...form, ownerId: form.ownerId ?? user?.id });
      setShowForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save the changes.");
    }
  }

  return (
    <div>
      <button onClick={openAdd} className="btn-primary text-sm mb-4">
        <Plus size={16} /> Add Used Product
      </button>

      <div className="flex flex-col gap-2">
        {usedItems.map((item) => (
          <div key={item.id} className="card-base flex items-center gap-3 p-3">
            <img src={item.image} alt={item.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-surface-alt" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{item.title}</p>
              <p className="text-xs text-ink-soft">{item.location} &middot; {formatPKR(item.price)}</p>
            </div>
            <button onClick={() => openEdit(item)} className="p-2 text-ink-soft hover:text-brand-600" aria-label="Edit"><Pencil size={16} /></button>
            <button onClick={() => {
              if (confirm("Delete this listing?")) {
                deleteUsedItem(item.id).catch((err: unknown) =>
                  alert(err instanceof Error ? err.message : "Could not delete the listing.")
                );
              }
            }} className="p-2 text-ink-soft hover:text-red-600" aria-label="Delete"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>

      {showForm && (
        <FormModal title={editing ? "Edit Used Product" : "Add Used Product"} onClose={() => setShowForm(false)} onSubmit={submit}>
          <TextField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Price (Rs.)" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
            <SelectField
              label="Condition"
              value={form.condition}
              options={["New", "Like New", "Used - Good", "Used - Fair"]}
              onChange={(v) => setForm({ ...form, condition: v as UsedItem["condition"] })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
            <TextField label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Seller name" value={form.seller} onChange={(v) => setForm({ ...form, seller: v })} />
            <NumberField label="Seller rating (0 to 5)" value={form.sellerRating} onChange={(v) => setForm({ ...form, sellerRating: v })} step="0.1" />
          </div>
          <TextField
            label="Seller phone (e.g. +923001234567)"
            value={form.phone ?? ""}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
          <TextField label="Image URL" value={form.image} onChange={(v) => setForm({ ...form, image: v })} />
          <TextAreaField label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <CheckField label="Negotiable" checked={form.negotiable} onChange={(v) => setForm({ ...form, negotiable: v })} />
          <CheckField
            label="Verified seller (only check this once verification is complete)"
            checked={!!form.verified}
            onChange={(v) => setForm({ ...form, verified: v })}
          />
        </FormModal>
      )}
    </div>
  );
}

/* ---------------- Automobiles ---------------- */

function AutomobilesPanel() {
  const { automobiles, addAutomobile, updateAutomobile, deleteAutomobile } = useListings();
  const { user } = useAuth();
  const [editing, setEditing] = useState<Automobile | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Automobile, "id">>(emptyAuto);

  function openAdd() {
    setEditing(null);
    setForm(emptyAuto);
    setShowForm(true);
  }
  function openEdit(a: Automobile) {
    setEditing(a);
    setForm(a);
    setShowForm(true);
  }
  async function submit() {
    if (!form.make.trim() || !form.model.trim() || !form.image.trim()) {
      alert("Make, model and image URL are required.");
      return;
    }
    try {
      if (editing) await updateAutomobile(editing.id, form);
      else await addAutomobile({ ...form, ownerId: form.ownerId ?? user?.id });
      setShowForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save the changes.");
    }
  }

  return (
    <div>
      <button onClick={openAdd} className="btn-primary text-sm mb-4">
        <Plus size={16} /> Add Vehicle
      </button>

      <div className="flex flex-col gap-2">
        {automobiles.map((a) => (
          <div key={a.id} className="card-base flex items-center gap-3 p-3">
            <img src={a.image} alt={`${a.make} ${a.model}`} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-surface-alt" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{a.make} {a.model} ({a.year})</p>
              <p className="text-xs text-ink-soft">{a.location} &middot; {formatPKR(a.price)}</p>
            </div>
            <button onClick={() => openEdit(a)} className="p-2 text-ink-soft hover:text-brand-600" aria-label="Edit"><Pencil size={16} /></button>
            <button onClick={() => {
              if (confirm("Delete this vehicle?")) {
                deleteAutomobile(a.id).catch((err: unknown) =>
                  alert(err instanceof Error ? err.message : "Could not delete the listing.")
                );
              }
            }} className="p-2 text-ink-soft hover:text-red-600" aria-label="Delete"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>

      {showForm && (
        <FormModal title={editing ? "Edit Vehicle" : "Add Vehicle"} onClose={() => setShowForm(false)} onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Make" value={form.make} onChange={(v) => setForm({ ...form, make: v })} />
            <TextField label="Model" value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Year" value={form.year} onChange={(v) => setForm({ ...form, year: v })} />
            <NumberField label="Price (Rs.)" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Mileage (km)" value={form.mileageKm} onChange={(v) => setForm({ ...form, mileageKm: v })} />
            <SelectField
              label="Type"
              value={form.type}
              options={["Car", "Bike", "SUV", "Truck", "Van", "Auto Part"]}
              onChange={(v) => setForm({ ...form, type: v as Automobile["type"] })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Fuel"
              value={form.fuel}
              options={["Petrol", "Diesel", "Hybrid", "Electric"]}
              onChange={(v) => setForm({ ...form, fuel: v as Automobile["fuel"] })}
            />
            <SelectField
              label="Transmission"
              value={form.transmission}
              options={["Manual", "Automatic"]}
              onChange={(v) => setForm({ ...form, transmission: v as Automobile["transmission"] })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <SelectField
              label="Condition"
              value={form.condition}
              options={["New", "Used"]}
              onChange={(v) => setForm({ ...form, condition: v as Automobile["condition"] })}
            />
          </div>
          <TextField label="Seller / Dealer" value={form.seller} onChange={(v) => setForm({ ...form, seller: v })} />
          <TextField
            label="Seller phone (e.g. +923001234567)"
            value={form.phone ?? ""}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
          <TextField label="Image URL" value={form.image} onChange={(v) => setForm({ ...form, image: v })} />
          <CheckField
            label="Verified dealer (only check this once verification is complete)"
            checked={!!form.verified}
            onChange={(v) => setForm({ ...form, verified: v })}
          />
        </FormModal>
      )}
    </div>
  );
}

/* ---------------- Shared form building blocks ---------------- */

function FormModal({
  title,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg text-ink">{title}</h3>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="flex flex-col gap-3.5">{children}</div>
        <div className="flex items-center gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => void onSubmit()} className="btn-primary flex-1">Save</button>
        </div>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-surface-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400"
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1 w-full border border-surface-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400 resize-none"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full border border-surface-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-surface-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400 bg-white"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o || "None"}</option>
        ))}
      </select>
    </label>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-brand-500"
      />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}
