import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Car } from "lucide-react";
import RequireAuth from "../components/RequireAuth";
import SellerPlanGate, {
  SellerPlanNotice,
  SellerTermsCheckbox,
} from "../components/SellerPlanGate";
import { TextField, NumberField, SelectField } from "../components/formFields";
import { useListings } from "../store/ListingsStore";
import { useAuth } from "../store/AuthStore";
import { useSellerPlan } from "../store/SellerPlanStore";
import type { Automobile } from "../data/types";

const emptyForm: Omit<Automobile, "id"> = {
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

export default function SellVehicle() {
  return (
    <RequireAuth>
      <SellerPlanGate>
        <SellVehicleForm />
      </SellerPlanGate>
    </RequireAuth>
  );
}

function SellVehicleForm() {
  const { addAutomobile } = useListings();
  const { user } = useAuth();
  const { plan, acceptTerms } = useSellerPlan();
  const navigate = useNavigate();
  const [form, setForm] = useState<Omit<Automobile, "id">>(() => ({
    ...emptyForm,
    seller: user?.name ?? "",
  }));
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.make.trim() ||
      !form.model.trim() ||
      !form.image.trim() ||
      !form.location.trim() ||
      !form.seller.trim() ||
      form.price <= 0
    ) {
      setError("Make, model, seller name, location, image URL, and price are required.");
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
      await addAutomobile({ ...form, ownerId: user?.id });
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
        <span className="text-ink">List Vehicle</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
          <Car size={22} />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-ink">List Your Vehicle</h1>
          <p className="text-sm text-ink-soft">Cars, bikes, and auto parts, listed in Automobiles.</p>
        </div>
      </div>

      <SellerPlanNotice />

      <form onSubmit={submit} className="card-base p-5 flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Make" value={form.make} onChange={(v) => setForm({ ...form, make: v })} required />
          <TextField label="Model" value={form.model} onChange={(v) => setForm({ ...form, model: v })} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Year" value={form.year} onChange={(v) => setForm({ ...form, year: v })} />
          <NumberField label="Price (Rs.)" value={form.price} onChange={(v) => setForm({ ...form, price: v })} required />
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
          <TextField label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} required />
          <SelectField
            label="Condition"
            value={form.condition}
            options={["New", "Used"]}
            onChange={(v) => setForm({ ...form, condition: v as Automobile["condition"] })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Your name (shown to buyers)" value={form.seller} onChange={(v) => setForm({ ...form, seller: v })} required />
          <TextField
            label="Phone (e.g. +923001234567)"
            value={form.phone ?? ""}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
        </div>

        <TextField label="Image URL" value={form.image} onChange={(v) => setForm({ ...form, image: v })} placeholder="https://…" required />

        <SellerTermsCheckbox checked={agreed} onChange={setAgreed} />

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <Link to="/sell" className="btn-secondary flex-1">Cancel</Link>
          <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-60">
            {submitting ? "Saving…" : "Publish vehicle"}
          </button>
        </div>
      </form>
    </div>
  );
}
