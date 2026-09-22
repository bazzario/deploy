/**
 * Seller free-listing period — pure calculation, no UI aur no network.
 *
 * Rule: naya seller pehle 12 mahine free list kar sakta hai. Uske baad
 * listing jaari rakhne ke liye paid seller plan chahiye. Fee abhi decide
 * nahi hui, isliye yahan koi price hardcode NAHI hai.
 *
 * Free period ki start date hamesha seller ke MOJOODA profile/account
 * creation date se aati hai (public.profiles.created_at). Ek alag
 * `seller_free_start` column sirf tab use hota hai jab admin manually
 * kisi seller ke liye start date override kare.
 */

import { site } from "../config/site";

/** Free listing window length (months) — single source of truth: site config. */
export const SELLER_FREE_MONTHS = site.policies.sellerFreeListingMonths;

export type SellerPlanStatus =
  /** Free 12-month window abhi chal rahi hai. */
  | "free"
  /** Free window khatam — renewal/payment required. */
  | "expired"
  /** Paid plan active hai (real payment gateway ke baad set hoga). */
  | "paid"
  /** Seller ka record abhi load nahi hua. */
  | "unknown";

/** Supabase `profiles` row ke woh fields jo plan calculate karne ke liye chahiye. */
export interface SellerPlanSource {
  /** profiles.created_at — account/profile creation date. */
  createdAt?: string | null;
  /** profiles.seller_free_start — optional manual override. */
  freeStart?: string | null;
  /** profiles.seller_plan_status — 'free' | 'paid' (DB ki apni value). */
  planStatus?: string | null;
  /** profiles.seller_plan_paid_until — paid plan ki expiry (future use). */
  paidUntil?: string | null;
  /** profiles.seller_terms_accepted_at — seller terms kab accept kiye. */
  termsAcceptedAt?: string | null;
}

export interface SellerPlan {
  status: SellerPlanStatus;
  /** Free period start (account creation date). */
  freeStart: Date | null;
  /** Free period end = start + 12 months. */
  freeEnd: Date | null;
  /** Paid plan ki expiry, agar koi paid plan set hai. */
  paidUntil: Date | null;
  /** Seller ne seller terms accept kiye ya nahi. */
  termsAccepted: boolean;
  termsAcceptedAt: Date | null;
  /** Naya listing banane ki ijazat hai ya nahi. */
  canList: boolean;
  /** Free period khatam hone mein kitne din baaki (expired ho to 0). */
  daysLeft: number;
}

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** start + n months (month-end safe: 31 Jan + 1 month -> 28/29 Feb). */
export function addMonths(start: Date, months: number): Date {
  const d = new Date(start.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export function computeSellerPlan(
  source: SellerPlanSource | null,
  now: Date = new Date()
): SellerPlan {
  if (!source) {
    return {
      status: "unknown",
      freeStart: null,
      freeEnd: null,
      paidUntil: null,
      termsAccepted: false,
      termsAcceptedAt: null,
      canList: false,
      daysLeft: 0,
    };
  }

  // Pehle manual override, warna mojooda profile creation date.
  const freeStart = toDate(source.freeStart) ?? toDate(source.createdAt);
  const freeEnd = freeStart ? addMonths(freeStart, SELLER_FREE_MONTHS) : null;
  const paidUntil = toDate(source.paidUntil);
  const termsAcceptedAt = toDate(source.termsAcceptedAt);

  const paidActive =
    String(source.planStatus ?? "").toLowerCase() === "paid" &&
    paidUntil !== null &&
    paidUntil.getTime() > now.getTime();

  const withinFree = freeEnd !== null && freeEnd.getTime() > now.getTime();

  const status: SellerPlanStatus = paidActive ? "paid" : withinFree ? "free" : "expired";

  const daysLeft =
    freeEnd && withinFree
      ? Math.max(0, Math.ceil((freeEnd.getTime() - now.getTime()) / 86_400_000))
      : 0;

  return {
    status,
    freeStart,
    freeEnd,
    paidUntil,
    termsAccepted: termsAcceptedAt !== null,
    termsAcceptedAt,
    canList: paidActive || withinFree,
    daysLeft,
  };
}

export function formatPlanDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
