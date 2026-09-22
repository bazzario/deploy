import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Clock, CreditCard } from "lucide-react";
import { useSellerPlan } from "../store/SellerPlanStore";
import { formatPlanDate, SELLER_FREE_MONTHS } from "../lib/sellerPlan";

/**
 * Listing forms ke aage lagne wala gate.
 *
 * - Free period chal rahi hai  -> form normal dikhta hai.
 * - Free period khatam         -> form block, renewal message.
 *
 * Yahan koi fake payment ya fake "payment successful" screen NAHI hai —
 * sirf ek renewal notice, jise baad mein real gateway se jora ja sakta hai.
 */
export default function SellerPlanGate({ children }: { children: ReactNode }) {
  const { plan, error } = useSellerPlan();

  // Only block on the very first load. The plan is re-checked in the background
  // whenever the login token refreshes; treating that as "loading" would unmount
  // the listing form and wipe whatever the seller had entered (and uploaded).
  if (plan.status === "unknown") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <p className="text-sm text-ink-soft">
          {error ?? "Checking your seller plan…"}
        </p>
      </div>
    );
  }

  if (!plan.canList) {
    return (
      <div className="container-page py-8 sm:py-12 max-w-2xl">
        <div className="card-base p-6 sm:p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mx-auto">
            <CreditCard size={22} />
          </div>
          <h1 className="font-display font-bold text-xl text-ink mt-3">
            Your free listing period has ended
          </h1>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed">
            Your first {SELLER_FREE_MONTHS} months of free listing ended on{" "}
            <strong className="text-ink">{formatPlanDate(plan.freeEnd)}</strong>. To publish new
            listings, a paid seller plan is required. Payments are made online to Bazaario.
          </p>
          <p className="text-xs text-ink-soft mt-3">
            Renew your seller plan to publish new listings again. Your existing listings are not
            affected.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <Link to="/seller" className="btn-secondary flex-1">
              Back to dashboard
            </Link>
            <Link to="/seller/renew" className="btn-primary flex-1">
              Renew seller plan
            </Link>
          </div>
          <p className="text-xs text-ink-soft mt-4">
            Read the <Link to="/terms" className="text-brand-600 font-medium">Seller Terms</Link>{" "}
            for full details.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Free period ka chhota sa reminder banner — listing forms ke upar. */
export function SellerPlanNotice() {
  const { plan } = useSellerPlan();
  if (plan.status !== "free" || !plan.freeEnd) return null;

  return (
    <div className="rounded-lg bg-brand-50 border border-brand-100 p-3 mb-4 flex items-start gap-2.5">
      <Clock size={15} className="text-brand-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-ink-soft leading-relaxed">
        Free listing is active. Your free {SELLER_FREE_MONTHS}-month period ends on{" "}
        <strong className="text-ink">{formatPlanDate(plan.freeEnd)}</strong>
        {plan.daysLeft > 0 ? ` (${plan.daysLeft} days left)` : ""}. After that, continued listing
        access requires a paid seller plan.
      </p>
    </div>
  );
}

/**
 * Publish se pehle Seller Terms ka agreement checkbox.
 * Parent form isko required rakhta hai.
 */
export function SellerTermsCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const { plan } = useSellerPlan();

  if (plan.termsAccepted) {
    return (
      <p className="text-xs text-ink-soft">
        You accepted the{" "}
        <Link to="/terms" className="text-brand-600 font-medium">Seller Terms</Link> on{" "}
        {formatPlanDate(plan.termsAcceptedAt)}.
      </p>
    );
  }

  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-brand-500 mt-0.5 flex-shrink-0"
      />
      <span className="text-xs text-ink-soft leading-relaxed">
        I agree to the{" "}
        <Link to="/terms" className="text-brand-600 font-medium" target="_blank">
          Seller Terms
        </Link>
        , including that listing is free for the first {SELLER_FREE_MONTHS} months and that a paid
        seller plan is required after that. <span className="text-red-500">*</span>
      </span>
    </label>
  );
}
