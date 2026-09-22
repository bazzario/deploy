import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CreditCard, Smartphone, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";
import RequireAuth from "../components/RequireAuth";
import { useAuth } from "../store/AuthStore";
import { useSellerPlan } from "../store/SellerPlanStore";
import { db, isSupabaseConfigured } from "../lib/supabase";
import { formatPlanDate, SELLER_FREE_MONTHS } from "../lib/sellerPlan";
import {
  GatewayNotConfiguredError,
  PAYMENT_METHODS,
  SELLER_PLAN_CURRENCY,
  SELLER_PLAN_MONTHS,
  SELLER_PLAN_PRICE,
  formatAmount,
  isGatewayConfigured,
  methodLabel,
  paymentFromRow,
  startSellerRenewal,
  type PaymentMethod,
  type SellerPayment,
} from "../lib/sellerBilling";

export default function SellerRenew() {
  return (
    <RequireAuth>
      <SellerRenewPage />
    </RequireAuth>
  );
}

function SellerRenewPage() {
  const { user, accessToken } = useAuth();
  const { plan, refresh } = useSellerPlan();

  const [method, setMethod] = useState<PaymentMethod>("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gatewayMissing, setGatewayMissing] = useState(false);
  const [payments, setPayments] = useState<SellerPayment[]>([]);

  // Gateway callback hamein yahan wapas bhejta hai: /seller/renew?payment=success
  const [params] = useSearchParams();
  const paymentResult = params.get("payment");

  const loadPayments = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    try {
      const rows = await db.select<Record<string, unknown>[]>(
        "seller_payments",
        `select=*&seller_id=eq.${user.id}&order=created_at.desc&limit=5`,
        accessToken ?? undefined
      );
      setPayments((rows ?? []).map(paymentFromRow));
    } catch {
      // Table abhi nahi bani ya policy allow nahi karti — history hide rahegi.
      setPayments([]);
    }
  }, [user, accessToken]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    // Gateway se wapas aane par server se taaza status lein.
    if (paymentResult) void refresh();
  }, [paymentResult, refresh]);

  async function pay() {
    setError("");
    setGatewayMissing(false);
    setBusy(true);
    try {
      const { redirectUrl } = await startSellerRenewal(method, accessToken);
      // Gateway ke hosted checkout par jayein. Payment wahin hoti hai, aur
      // "paid" ka faisla server-side callback/webhook karta hai.
      window.location.href = redirectUrl;
    } catch (err) {
      if (err instanceof GatewayNotConfiguredError) {
        setGatewayMissing(true);
      } else {
        setError(err instanceof Error ? err.message : "Could not start the payment.");
      }
      setBusy(false);
    }
  }

  const priceLabel = formatAmount(SELLER_PLAN_PRICE, SELLER_PLAN_CURRENCY);
  const active = plan.status === "paid";

  return (
    <div className="container-page py-8 sm:py-12 max-w-2xl">
      <h1 className="font-display font-bold text-2xl text-ink">Seller Plan Renewal</h1>
      <p className="text-sm text-ink-soft mt-2 leading-relaxed">
        {active ? (
          <>
            Your seller plan is active until{" "}
            <strong className="text-ink">{formatPlanDate(plan.paidUntil)}</strong>. You can renew
            early if you want to extend it.
          </>
        ) : (
          <>
            Your free {SELLER_FREE_MONTHS}-month period ended on{" "}
            <strong className="text-ink">{formatPlanDate(plan.freeEnd)}</strong>. Renew your seller
            plan to publish new listings again. Your existing listings stay published.
          </>
        )}
      </p>

      {paymentResult && (
        <div
          className={`rounded-lg border p-3 mt-5 ${
            paymentResult === "success"
              ? "bg-green-50 border-green-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <p
            className={`text-xs leading-relaxed ${
              paymentResult === "success" ? "text-green-800" : "text-amber-800"
            }`}
          >
            {paymentResult === "success"
              ? "Payment confirmed. Your seller plan has been extended. The dates below are updated from our server."
              : paymentResult === "failed"
                ? "That payment could not be verified, so nothing was changed. If money left your account, please contact us with your transaction ID."
                : "We couldn't confirm the result of that payment. Please check the payment history below or contact us."}
          </p>
        </div>
      )}

      {/* ------------------------------ plan summary ------------------------------ */}
      <div className="card-base p-5 mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-ink-soft">Plan</p>
            <p className="font-semibold text-ink">Seller Listing Renewal</p>
            <p className="text-xs text-ink-soft mt-0.5">{SELLER_PLAN_MONTHS} months of listing access</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-soft">Amount</p>
            {priceLabel ? (
              <p className="font-display font-bold text-xl text-ink">{priceLabel}</p>
            ) : (
              <p className="text-sm font-medium text-amber-700">Not set yet</p>
            )}
          </div>
        </div>

        {!priceLabel && (
          <p className="text-xs text-ink-soft mt-3 border-t border-surface-border pt-3">
            The renewal price has not been configured yet. It is set on the server and shown here
            once configured. No price is assumed by this page.
          </p>
        )}
      </div>

      {/* ----------------------------- payment methods ----------------------------- */}
      <h2 className="section-title !text-base mt-8 mb-3">Payment method</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        {PAYMENT_METHODS.map((m) => {
          const selected = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`card-base p-4 text-left transition-colors ${
                selected ? "border-brand-400 bg-brand-50" : "hover:border-brand-400"
              }`}
            >
              {m.id === "card" ? (
                <CreditCard size={18} className="text-brand-500" />
              ) : (
                <Smartphone size={18} className="text-brand-500" />
              )}
              <p className="text-sm font-semibold text-ink mt-2">{m.label}</p>
              <p className="text-xs text-ink-soft mt-0.5">{m.hint}</p>
            </button>
          );
        })}
      </div>

      {gatewayMissing && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-4 flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-900">Payment gateway not configured</p>
            <p className="text-[11px] text-amber-800 leading-relaxed mt-1">
              Online renewal isn't live yet, so no payment can be taken. Nothing has been charged
              and your plan is unchanged. Please{" "}
              <Link to="/contact" className="underline font-medium">contact us</Link> to arrange
              renewal in the meantime.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-4">
          {error}
        </p>
      )}

      <button
        onClick={() => void pay()}
        disabled={busy}
        className="btn-primary w-full mt-5 !py-3 disabled:opacity-60"
      >
        {busy ? "Opening secure checkout…" : `Pay with ${methodLabel(method)}`}
      </button>

      <p className="text-[11px] text-ink-soft mt-3 flex items-start gap-1.5">
        <ShieldCheck size={13} className="text-brand-500 flex-shrink-0 mt-0.5" />
        You'll complete the payment on the provider's secure page. Your plan is only extended after
        the provider confirms the payment to our server, never from this page alone.
      </p>

      {!isGatewayConfigured && !gatewayMissing && (
        <p className="text-[11px] text-amber-700 mt-2">
          Note: the online gateway isn't connected yet, so this button will report that renewal
          isn't available.
        </p>
      )}

      {/* ------------------------------ payment history ------------------------------ */}
      {payments.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-10 mb-3">
            <h2 className="section-title !text-base !mb-0">Recent payments</h2>
            <button
              onClick={() => {
                void loadPayments();
                void refresh();
              }}
              className="text-xs text-ink-soft hover:text-brand-600 inline-flex items-center gap-1"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {payments.map((p) => (
              <div key={p.id} className="card-base p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {methodLabel(p.paymentMethod)}
                    {p.amount != null ? ` · ${formatAmount(p.amount, p.currency)}` : ""}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {formatPlanDate(p.createdAt ? new Date(p.createdAt) : null)}
                    {p.transactionId ? ` · ${p.transactionId}` : ""}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                    p.status === "paid"
                      ? "bg-green-50 text-green-700"
                      : p.status === "pending"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-surface-alt text-ink-soft"
                  }`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <Link to="/seller" className="btn-secondary flex-1">Back to dashboard</Link>
        <Link to="/terms" className="btn-secondary flex-1">Seller Terms</Link>
      </div>
    </div>
  );
}
