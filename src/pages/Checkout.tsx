import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PackageSearch, ShieldCheck, Minus, Plus } from "lucide-react";
import { useListings } from "../store/ListingsStore";
import { useOrders } from "../store/OrdersStore";
import { useAuth } from "../store/AuthStore";
import { calcTotals, isOutOfStock, maxOrderableQty } from "../lib/checkout";
import { formatPKR } from "../lib/format";
import { primaryImage } from "../lib/productImages";
import { site } from "../config/site";

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  notes: string;
  paymentMethod: string;
}

type Errors = Partial<Record<keyof FormState, string>> & { qty?: string };

const paymentOptions = site.policies.paymentMethods.length
  ? site.policies.paymentMethods
  : ["Cash on Delivery"];

export default function Checkout() {
  const [params] = useSearchParams();
  const productId = params.get("productId") ?? "";
  const requestedQty = Math.max(1, Number(params.get("qty")) || 1);

  const { products, updateProduct } = useListings();
  const { placeOrder } = useOrders();
  const { user } = useAuth();
  const navigate = useNavigate();

  const product = products.find((p) => p.id === productId);
  const outOfStock = product ? isOutOfStock(product) : false;
  const maxQty = product ? Math.max(1, maxOrderableQty(product)) : 1;

  const [qty, setQty] = useState(() => Math.min(requestedQty, maxQty));
  const [form, setForm] = useState<FormState>({
    name: user?.name ?? "",
    phone: "",
    email: user?.email ?? "",
    address: "",
    city: "",
    notes: "",
    paymentMethod: paymentOptions[0],
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submittedRef = useRef(false);

  const items = useMemo(() => (product ? [{ product, qty }] : []), [product, qty]);
  const totals = calcTotals(items);

  if (!product) {
    return (
      <div className="container-page py-16 sm:py-24 text-center">
        <PackageSearch size={40} className="mx-auto text-ink-soft" />
        <h1 className="font-display font-bold text-xl text-ink mt-4">No product selected for checkout</h1>
        <p className="text-sm text-ink-soft mt-1.5">
          Please go back and tap "Buy Now" on a product to start checkout.
        </p>
        <Link to="/products" className="btn-primary mt-6 inline-flex">Browse Products</Link>
      </div>
    );
  }

  if (outOfStock) {
    return (
      <div className="container-page py-16 sm:py-24 text-center">
        <PackageSearch size={40} className="mx-auto text-ink-soft" />
        <h1 className="font-display font-bold text-xl text-ink mt-4">This product is out of stock</h1>
        <p className="text-sm text-ink-soft mt-1.5">Please check back later or browse similar products.</p>
        <Link to={`/products/${product.id}`} className="btn-primary mt-6 inline-flex">Back to Product</Link>
      </div>
    );
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function changeQty(next: number) {
    setQty(Math.max(1, Math.min(maxQty, next)));
    setErrors((prev) => ({ ...prev, qty: undefined }));
  }

  function validate(): Errors {
    const next: Errors = {};
    if (form.name.trim().length < 3) next.name = "Please enter your full name.";
    if (!/^[0-9+\-\s()]{10,15}$/.test(form.phone.trim()))
      next.phone = "Please enter a valid mobile number (e.g. 0300 1234567).";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "Please enter a valid email address.";
    if (form.address.trim().length < 10) next.address = "Please enter your full delivery address.";
    if (form.city.trim().length < 2) next.city = "Please enter your city.";
    if (qty < 1) next.qty = "Quantity must be at least 1.";
    if (product && product.stock !== undefined && qty > product.stock)
      next.qty = `Only ${product.stock} left in stock.`;
    return next;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    // Guard against double-clicks / double submits creating duplicate orders.
    if (submittedRef.current || submitting) return;

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    // Re-check availability right before placing the order.
    const latestProduct = products.find((p) => p.id === product?.id);
    if (!latestProduct || (latestProduct.stock !== undefined && latestProduct.stock < qty)) {
      setSubmitError("Sorry, this product no longer has enough stock for this order.");
      return;
    }

    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError("");

    try {
      const order = await placeOrder({
        items: [
          {
            id: latestProduct.id,
            title: latestProduct.title,
            price: latestProduct.price,
            qty,
            image: primaryImage(latestProduct),
            // Seller ownership comes from the listing record itself — never from the
            // form or URL. The database also re-stamps this on insert, so a tampered
            // request can't change which seller an order line belongs to.
            sellerId: latestProduct.ownerId ?? null,
          },
        ],
        subtotal: totals.subtotal,
        delivery: totals.delivery,
        total: totals.total,
        customer: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          notes: form.notes.trim(),
        },
        paymentMethod: form.paymentMethod,
      });

      // Best-effort stock decrement — order is already placed either way.
      if (latestProduct.stock !== undefined) {
        try {
          await updateProduct(latestProduct.id, {
            ...latestProduct,
            stock: Math.max(0, latestProduct.stock - qty),
          });
        } catch {
          // Non-critical — the order itself has already been saved.
        }
      }

      navigate(`/orders/${order.id}`, { replace: true });
    } catch (err) {
      submittedRef.current = false;
      setSubmitting(false);
      setSubmitError(
        err instanceof Error ? err.message : "Could not place your order. Please try again."
      );
    }
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="font-display font-bold text-xl sm:text-2xl text-ink mb-6">Checkout</h1>

      <form onSubmit={submit} className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="card-base p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-ink">Delivery details</h2>

          <Field label="Full name" error={errors.name}>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoComplete="name"
              className="input-base"
              placeholder="Ali Khan"
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Mobile number" error={errors.phone}>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                className="input-base"
                placeholder="0300 1234567"
              />
            </Field>
            <Field label="Email (optional)" error={errors.email}>
              <input
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                inputMode="email"
                autoComplete="email"
                className="input-base"
                placeholder="you@email.com"
              />
            </Field>
          </div>

          <Field label="Delivery address" error={errors.address}>
            <textarea
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              rows={3}
              autoComplete="street-address"
              className="input-base resize-none"
              placeholder="House / flat number, street, area"
            />
          </Field>

          <Field label="City" error={errors.city}>
            <input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              autoComplete="address-level2"
              className="input-base"
              placeholder="Islamabad"
            />
          </Field>

          <Field label="Order notes (optional)">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="input-base resize-none"
              placeholder="Landmark or delivery instructions"
            />
          </Field>

          <div>
            <span className="text-xs font-medium text-ink-soft mb-2 block">Payment method</span>
            <div className="flex flex-col gap-2">
              {paymentOptions.map((method) => (
                <label
                  key={method}
                  className={`flex items-center gap-2.5 border rounded-lg px-3 py-2.5 cursor-pointer text-sm ${
                    form.paymentMethod === method
                      ? "border-brand-400 bg-brand-50/50"
                      : "border-surface-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={method}
                    checked={form.paymentMethod === method}
                    onChange={() => set("paymentMethod", method)}
                    className="accent-brand-500"
                  />
                  <span className="text-ink">{method}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="card-base p-4 h-fit lg:sticky lg:top-24">
          <h2 className="font-semibold text-ink mb-3">Order Summary</h2>

          <div className="flex items-center gap-2.5 mb-3">
            <img
              src={primaryImage(product)}
              alt={product.title}
              className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-surface-alt"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink line-clamp-2">{product.title}</p>
              <span className="text-xs text-ink-soft">{formatPKR(product.price)} each</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-ink-soft">Quantity</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => changeQty(qty - 1)}
                aria-label="Decrease quantity"
                className="w-7 h-7 rounded-full border border-surface-border flex items-center justify-center text-ink-soft hover:border-brand-400 hover:text-brand-600"
              >
                <Minus size={13} />
              </button>
              <span className="w-8 text-center text-sm font-semibold text-ink">{qty}</span>
              <button
                type="button"
                onClick={() => changeQty(qty + 1)}
                aria-label="Increase quantity"
                className="w-7 h-7 rounded-full border border-surface-border flex items-center justify-center text-ink-soft hover:border-brand-400 hover:text-brand-600"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
          {errors.qty && <p className="text-xs text-red-600 mb-2">{errors.qty}</p>}

          <Row label="Subtotal" value={formatPKR(totals.subtotal)} />
          <Row label="Delivery" value={totals.delivery === 0 ? "Free" : formatPKR(totals.delivery)} />
          <div className="flex items-center justify-between font-display font-bold text-base text-ink border-t border-surface-border mt-2 pt-3">
            <span>Total</span>
            <span>{formatPKR(totals.total)}</span>
          </div>

          {submitError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3">
              {submitError}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full mt-4 disabled:opacity-60">
            {submitting ? "Placing order…" : "Place Order"}
          </button>

          <p className="flex items-start gap-1.5 text-[11px] text-ink-soft mt-3">
            <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />
            After placing your order, we'll call or message you to confirm the details.
          </p>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-soft mb-1 block">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600 mt-1 block">{error}</span>}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm text-ink-soft py-1.5">
      <span>{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  );
}
