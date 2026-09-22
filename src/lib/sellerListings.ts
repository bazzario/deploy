/**
 * The signed-in seller's OWN listings, read straight from the database.
 *
 * The Seller Dashboard used to count listings by filtering the public catalog
 * (store/ListingsStore.tsx) in the browser. That catalog is one all-or-nothing
 * fetch of every seller's listings which, when any of its three requests fails,
 * silently swaps in the built-in sample listings (they have no owner) — so a
 * seller saw "0 products / You haven't listed anything yet" instead of an error.
 * It is also capped by PostgREST's row limit, newest first, so older listings of
 * a seller dropped out as the marketplace grew.
 *
 * Here every table is queried with `owner_id = <me>`, so the database returns
 * exactly this seller's rows. Ownership is never widened: other sellers' rows are
 * not requested, and Row Level Security still applies on top. A table that fails
 * to load is reported as failed (count unknown) — never as zero.
 */
import type { Automobile, Product, UsedItem } from "../data/types";
import { db } from "./supabase";
import { isUuid } from "./ids";
import { autoFromRow, productFromRow, usedFromRow, type Row } from "./listingRows";

export interface MyListingsResult {
  products: Product[];
  usedItems: UsedItem[];
  automobiles: Automobile[];
  /** true = that table could not be read, so its list above is NOT a real "empty". */
  failed: { products: boolean; usedItems: boolean; automobiles: boolean };
}

export const NO_LISTINGS: MyListingsResult = {
  products: [],
  usedItems: [],
  automobiles: [],
  failed: { products: false, usedItems: false, automobiles: false },
};

export function buildMyListingsQuery(sellerId: string): string {
  if (!isUuid(sellerId)) throw new Error("Your account id is not valid, so listings can't be loaded.");
  return `select=*&owner_id=eq.${sellerId}&order=created_at.desc`;
}

export async function fetchMyListings(
  sellerId: string,
  accessToken: string | undefined
): Promise<MyListingsResult> {
  let query: string;
  try {
    query = buildMyListingsQuery(sellerId);
  } catch (err) {
    console.error(err);
    return { ...NO_LISTINGS, failed: { products: true, usedItems: true, automobiles: true } };
  }

  // allSettled: one broken table must not hide the seller's listings in the others.
  const [products, usedItems, automobiles] = await Promise.allSettled([
    db.select<Row[]>("products", query, accessToken),
    db.select<Row[]>("used_items", query, accessToken),
    db.select<Row[]>("automobiles", query, accessToken),
  ]);

  for (const [name, result] of [
    ["products", products],
    ["used_items", usedItems],
    ["automobiles", automobiles],
  ] as const) {
    if (result.status === "rejected") console.error(`Could not load your ${name}:`, result.reason);
  }

  return {
    products: products.status === "fulfilled" ? (products.value ?? []).map(productFromRow) : [],
    usedItems: usedItems.status === "fulfilled" ? (usedItems.value ?? []).map(usedFromRow) : [],
    automobiles: automobiles.status === "fulfilled" ? (automobiles.value ?? []).map(autoFromRow) : [],
    failed: {
      products: products.status === "rejected",
      usedItems: usedItems.status === "rejected",
      automobiles: automobiles.status === "rejected",
    },
  };
}
