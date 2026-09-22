/**
 * Seller plan renewal — frontend side ka payment client.
 *
 * ZAROORI SECURITY RULE:
 * Yahan koi merchant credential, secret key, salt ya service_role key NAHI
 * aata. Frontend sirf itna karta hai:
 *   1. Supabase Edge Function ko bulata hai (user ke apne access token ke saath)
 *   2. Function payment banata hai aur gateway ka redirect URL wapas deta hai
 *   3. Browser gateway par chala jata hai
 * Payment ka "paid" hona SIRF gateway ke server-side callback/webhook se
 * confirm hota hai — is file se nahi.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./supabase";

const env = import.meta.env as Record<string, string | undefined>;

/**
 * Deployed Edge Function ka naam, e.g. "create-seller-payment".
 * Jab tak yeh set nahi hota, gateway "not configured" mana jata hai aur UI
 * koi fake success nahi dikhati.
 */
export const SELLER_PAYMENT_FUNCTION = (env.VITE_SELLER_PAYMENT_FUNCTION ?? "").trim();

/** Plan ki keemat server par tay hoti hai; yeh sirf display ke liye hai. */
export const SELLER_PLAN_PRICE = (() => {
  const raw = (env.VITE_SELLER_PLAN_PRICE ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
})();

export const SELLER_PLAN_CURRENCY = (env.VITE_SELLER_PLAN_CURRENCY ?? "PKR").trim() || "PKR";

/** Renewal kitne mahine ka hota hai (display ke liye; asli value server par). */
export const SELLER_PLAN_MONTHS = Number(env.VITE_SELLER_PLAN_MONTHS ?? 12) || 12;

export const isGatewayConfigured = Boolean(isSupabaseConfigured && SELLER_PAYMENT_FUNCTION);

export type PaymentMethod = "card" | "jazzcash" | "easypaisa";

export interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  hint: string;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: "card", label: "Debit / Credit Card", hint: "Visa or Mastercard" },
  { id: "jazzcash", label: "JazzCash", hint: "Mobile account or voucher" },
  { id: "easypaisa", label: "Easypaisa", hint: "Mobile account or voucher" },
];

export class GatewayNotConfiguredError extends Error {
  constructor() {
    super("Payment gateway not configured.");
    this.name = "GatewayNotConfiguredError";
  }
}

export interface StartPaymentResult {
  /** Gateway ka hosted checkout URL — browser isi par jata hai. */
  redirectUrl: string;
  /** seller_payments.id — pending record jo function ne banaya. */
  paymentId: string;
}

/**
 * Edge Function ko bula kar ek PENDING payment banata hai aur gateway ka
 * redirect URL leta hai. Yeh function kabhi bhi apne aap "paid" nahi karta.
 */
export async function startSellerRenewal(
  method: PaymentMethod,
  accessToken: string | null
): Promise<StartPaymentResult> {
  if (!isGatewayConfigured) throw new GatewayNotConfiguredError();
  if (!accessToken) throw new Error("Please sign in again before paying.");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${SELLER_PAYMENT_FUNCTION}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ method }),
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const message =
      (typeof data.error === "string" && data.error) ||
      (typeof data.message === "string" && data.message) ||
      `Could not start the payment (${res.status}).`;
    throw new Error(message);
  }

  const redirectUrl = typeof data.redirect_url === "string" ? data.redirect_url : "";
  const paymentId = typeof data.payment_id === "string" ? data.payment_id : "";
  if (!redirectUrl) {
    throw new Error("The payment gateway did not return a checkout link.");
  }
  return { redirectUrl, paymentId };
}

/* ------------------------------ payment rows ------------------------------ */

export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export interface SellerPayment {
  id: string;
  plan: string;
  amount: number | null;
  currency: string;
  paymentMethod: string;
  transactionId: string | null;
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
}

export function paymentFromRow(r: Record<string, unknown>): SellerPayment {
  return {
    id: String(r.id),
    plan: String(r.plan ?? ""),
    amount: r.amount == null ? null : Number(r.amount),
    currency: String(r.currency ?? SELLER_PLAN_CURRENCY),
    paymentMethod: String(r.payment_method ?? ""),
    transactionId: r.transaction_id ? String(r.transaction_id) : null,
    status: (String(r.status ?? "pending") as PaymentStatus) ?? "pending",
    createdAt: String(r.created_at ?? ""),
    paidAt: r.paid_at ? String(r.paid_at) : null,
  };
}

export function formatAmount(amount: number | null, currency = SELLER_PLAN_CURRENCY) {
  if (amount == null) return null;
  return `${currency === "PKR" ? "Rs." : currency} ${amount.toLocaleString("en-PK")}`;
}

export function methodLabel(id: string) {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;
}
