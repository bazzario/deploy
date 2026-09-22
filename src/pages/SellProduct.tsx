import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Package } from "lucide-react";
import RequireAuth from "../components/RequireAuth";
import SellerPlanGate, {
  SellerPlanNotice,
  SellerTermsCheckbox,
} from "../components/SellerPlanGate";
import { TextField, NumberField, SelectField, CheckField } from "../components/formFields";
import ProductImageManager from "../components/ProductImageManager";
import { useListings } from "../store/ListingsStore";
import { useAuth } from "../store/AuthStore";
import { useSellerPlan } from "../store/SellerPlanStore";
import { categories } from "../data/products";
import { deleteProductFolder, newProductId, sweepUnusedProductImages } from "../lib/productImages";
import type { Product } from "../data/types";

const emptyForm: Omit<Product, "id"> = {
  title: "",
  brand: "",
  category: categories[0]?.id ?? "electronics",
  price: 0,
  originalPrice: undefined,
  rating: 0,
  reviews: 0,
  image: "",
  images: [],
  badge: undefined,
  freeDelivery: false,
};

export default function SellProduct() {
  return (
    <RequireAuth>
      <SellerPlanGate>
        <SellProductForm />
      </SellerPlanGate>
    </RequireAuth>
  );
}

function SellProductForm() {
  const { addProduct } = useListings();
  const { user, ensureSession } = useAuth();
  const { plan, acceptTerms } = useSellerPlan();
  const navigate = useNavigate();
  const [form, setForm] = useState<Omit<Product, "id">>(emptyForm);
  // The product's id is chosen now (not by the database) so photos can be uploaded
  // to products/<id>/ before the row is saved; the same id is used when publishing.
  const [productId] = useState(newProductId);
  const [images, setImages] = useState<string[]>([]);
  const [imagesBusy, setImagesBusy] = useState(false);
  const uploadedRef = useRef(false);
  const publishedRef = useRef(false);
  const ensureSessionRef = useRef(ensureSession);
  ensureSessionRef.current = ensureSession;

  // Leaving without publishing (Cancel, back button, closing the form): delete the
  // photos that were uploaded for this draft so they don't pile up in Storage.
  useEffect(() => {
    return () => {
      if (uploadedRef.current && !publishedRef.current) {
        void ensureSessionRef
          .current()
          .then((s) => deleteProductFolder(productId, s.userId, s.accessToken))
          .catch(() => {});
      }
    };
  }, [productId]);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (imagesBusy) {
      setError("Please wait for the images to finish uploading.");
      return;
    }
    if (!form.title.trim() || !form.brand.trim() || images.length === 0 || form.price <= 0) {
      setError("Title, brand, at least one image, and price (greater than 0) are required.");
      return;
    }
    if (!plan.termsAccepted && !agreed) {
      setError("Please agree to the Seller Terms before publishing this listing.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      if (!plan.termsAccepted) await acceptTerms();
      // The first image is the primary one; `image` mirrors it for older code paths.
      await addProduct({ ...form, id: productId, image: images[0], images, ownerId: user?.id });
      publishedRef.current = true; // set before navigating, so the cleanup above leaves the files alone
      // Remove any stored file the final list no longer uses (e.g. a failed delete earlier).
      void ensureSessionRef
        .current()
        .then((s) => sweepUnusedProductImages(productId, s.userId, images, s.accessToken))
        .catch(() => {});
      navigate("/seller", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the listing.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-page py-6 sm:py-8 max-w-2xl">
      <div className="flex items-center gap-1 text-xs text-ink-soft mb-4 flex-wrap">
        <Link to="/sell" className="hover:text-brand-600">Sell</Link>
        <ChevronRight size={12} />
        <span className="text-ink">Add a Product</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
          <Package size={22} />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-ink">Add a Product</h1>
          <p className="text-sm text-ink-soft">List new inventory as a business seller.</p>
        </div>
      </div>

      <SellerPlanNotice />

      <form onSubmit={submit} className="card-base p-5 flex flex-col gap-3.5">
        <TextField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
        <TextField label="Brand" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} required />

        <SelectField
          label="Category"
          value={form.category}
          options={categories.map((c) => c.id)}
          onChange={(v) => setForm({ ...form, category: v })}
        />

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Price (Rs.)"
            value={form.price}
            onChange={(v) => setForm({ ...form, price: v })}
            required
          />
          <NumberField
            label="Original price (optional)"
            value={form.originalPrice ?? 0}
            onChange={(v) => setForm({ ...form, originalPrice: v || undefined })}
          />
        </div>

        <ProductImageManager
          productId={productId}
          onChange={setImages}
          onBusyChange={setImagesBusy}
          onUploadStart={() => {
            uploadedRef.current = true;
          }}
        />

        <CheckField
          label="Free delivery"
          checked={!!form.freeDelivery}
          onChange={(v) => setForm({ ...form, freeDelivery: v })}
        />

        <SellerTermsCheckbox checked={agreed} onChange={setAgreed} />

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <Link to="/sell" className="btn-secondary flex-1">Cancel</Link>
          <button
            type="submit"
            disabled={submitting || imagesBusy}
            className="btn-primary flex-1 disabled:opacity-60"
          >
            {submitting ? "Saving…" : imagesBusy ? "Uploading images…" : "Publish product"}
          </button>
        </div>
      </form>
    </div>
  );
}
