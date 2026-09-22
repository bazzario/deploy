import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Tag } from "lucide-react";
import RequireAuth from "../components/RequireAuth";
import SellerPlanGate, {
  SellerPlanNotice,
  SellerTermsCheckbox,
} from "../components/SellerPlanGate";
import { TextField, TextAreaField, NumberField, SelectField, CheckField } from "../components/formFields";
import UsedItemImageUploader from "../components/UsedItemImageUploader";
import { useListings } from "../store/ListingsStore";
import { useAuth } from "../store/AuthStore";
import { useSellerPlan } from "../store/SellerPlanStore";
import { deleteProductFolder, newProductId, sweepUnusedProductImages } from "../lib/productImages";
import type { UsedItem } from "../data/types";

const emptyForm: Omit<UsedItem, "id"> = {
  title: "",
  price: 0,
  negotiable: true,
  condition: "Used - Good",
  location: "",
  seller: "",
  sellerRating: 0,
  postedAgo: "Just now",
  image: "",
  category: "Electronics",
  description: "",
  phone: "",
  verified: false,
};

export default function SellUsedItem() {
  return (
    <RequireAuth>
      <SellerPlanGate>
        <SellUsedItemForm />
      </SellerPlanGate>
    </RequireAuth>
  );
}

function SellUsedItemForm() {
  const { addUsedItem } = useListings();
  const { user, ensureSession } = useAuth();
  const { plan, acceptTerms } = useSellerPlan();
  const navigate = useNavigate();
  const [form, setForm] = useState<Omit<UsedItem, "id">>(() => ({
    ...emptyForm,
    seller: user?.name ?? "",
  }));
  // Photos are uploaded before the listing row exists, into a folder named after this
  // draft id (same mechanism as the New Product form). Nothing about it is stored in
  // the database yet — only the first photo's URL goes into `image`.
  const [draftId] = useState(newProductId);
  const [images, setImages] = useState<string[]>([]);
  const [imagesBusy, setImagesBusy] = useState(false);
  const uploadedRef = useRef(false);
  const publishedRef = useRef(false);
  const ensureSessionRef = useRef(ensureSession);
  ensureSessionRef.current = ensureSession;

  // Leaving without publishing (Cancel, back button, closing the form): delete the
  // photos uploaded for this draft so they don't pile up in Storage.
  useEffect(() => {
    return () => {
      if (uploadedRef.current && !publishedRef.current) {
        void ensureSessionRef
          .current()
          .then((s) => deleteProductFolder(draftId, s.userId, s.accessToken))
          .catch(() => {});
      }
    };
  }, [draftId]);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (imagesBusy) {
      setError("Please wait for the images to finish uploading.");
      return;
    }
    if (
      !form.title.trim() ||
      images.length === 0 ||
      !form.location.trim() ||
      !form.seller.trim() ||
      form.price <= 0
    ) {
      setError("Title, seller name, location, at least one image, and price (greater than 0) are required.");
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
      // used_items has a single `image` column for now, so the first (main) photo is
      // the one that gets saved. Extra photos need a schema change (a later step).
      const savedImages = images.slice(0, 1);
      await addUsedItem({ ...form, image: savedImages[0], ownerId: user?.id });
      publishedRef.current = true; // set before navigating, so the cleanup above leaves the files alone
      // Remove every uploaded file the saved listing doesn't reference.
      void ensureSessionRef
        .current()
        .then((s) => sweepUnusedProductImages(draftId, s.userId, savedImages, s.accessToken))
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
        <span className="text-ink">Post a Used Product</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
          <Tag size={22} />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-ink">Post a Used Product</h1>
          <p className="text-sm text-ink-soft">Sell something you no longer need, free.</p>
        </div>
      </div>

      <SellerPlanNotice />

      <form onSubmit={submit} className="card-base p-5 flex flex-col gap-3.5">
        <TextField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />

        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Price (Rs.)" value={form.price} onChange={(v) => setForm({ ...form, price: v })} required />
          <SelectField
            label="Condition"
            value={form.condition}
            options={["New", "Like New", "Used - Good", "Used - Fair"]}
            onChange={(v) => setForm({ ...form, condition: v as UsedItem["condition"] })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
          <TextField label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Your name (shown to buyers)" value={form.seller} onChange={(v) => setForm({ ...form, seller: v })} required />
          <TextField
            label="Phone (e.g. +923001234567)"
            value={form.phone ?? ""}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
        </div>

        <UsedItemImageUploader
          draftId={draftId}
          onChange={setImages}
          onBusyChange={setImagesBusy}
          onUploadStart={() => {
            uploadedRef.current = true;
          }}
          disabled={submitting}
        />
        <TextAreaField label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <CheckField label="Price is negotiable" checked={form.negotiable} onChange={(v) => setForm({ ...form, negotiable: v })} />

        <SellerTermsCheckbox checked={agreed} onChange={setAgreed} />

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <Link to="/sell" className="btn-secondary flex-1">Cancel</Link>
          <button type="submit" disabled={submitting || imagesBusy} className="btn-primary flex-1 disabled:opacity-60">
            {submitting ? "Saving…" : imagesBusy ? "Uploading images…" : "Publish listing"}
          </button>
        </div>
      </form>
    </div>
  );
}
