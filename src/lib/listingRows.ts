/**
 * Supabase row -> app object mappers for the three listing tables. Shared by the
 * public catalog (store/ListingsStore.tsx) and the seller's own-listings query
 * (lib/sellerListings.ts) so both read a row exactly the same way.
 */
import type { Product, UsedItem, Automobile } from "../data/types";
import { normalizeImages } from "./productImages";

export type Row = Record<string, unknown>;

// `images` is the source of truth; older rows (or a database that hasn't been
// migrated) only have the single `image`, which becomes a one-item list.
export const productFromRow = (r: Row): Product => {
  const images = normalizeImages(r.images, r.image);
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    brand: String(r.brand ?? ""),
    category: String(r.category ?? ""),
    price: Number(r.price ?? 0),
    originalPrice: r.original_price == null ? undefined : Number(r.original_price),
    rating: Number(r.rating ?? 0),
    reviews: Number(r.reviews ?? 0),
    image: images[0] ?? String(r.image ?? ""),
    images,
    badge: (r.badge as Product["badge"]) ?? undefined,
    freeDelivery: Boolean(r.free_delivery),
    stock: r.stock == null ? undefined : Number(r.stock),
    ownerId: r.owner_id ? String(r.owner_id) : undefined,
    fromBackend: true,
  };
};

export const usedFromRow = (r: Row): UsedItem => ({
  id: String(r.id),
  title: String(r.title ?? ""),
  price: Number(r.price ?? 0),
  negotiable: Boolean(r.negotiable),
  condition: (r.condition as UsedItem["condition"]) ?? "Used - Good",
  location: String(r.location ?? ""),
  seller: String(r.seller ?? ""),
  sellerRating: Number(r.seller_rating ?? 0),
  postedAgo: String(r.posted_ago ?? ""),
  image: String(r.image ?? ""),
  category: String(r.category ?? ""),
  description: String(r.description ?? ""),
  phone: r.phone ? String(r.phone) : undefined,
  verified: Boolean(r.verified),
  ownerId: r.owner_id ? String(r.owner_id) : undefined,
  fromBackend: true,
});

export const autoFromRow = (r: Row): Automobile => ({
  id: String(r.id),
  make: String(r.make ?? ""),
  model: String(r.model ?? ""),
  year: Number(r.year ?? 0),
  price: Number(r.price ?? 0),
  mileageKm: Number(r.mileage_km ?? 0),
  fuel: (r.fuel as Automobile["fuel"]) ?? "Petrol",
  transmission: (r.transmission as Automobile["transmission"]) ?? "Manual",
  location: String(r.location ?? ""),
  condition: (r.condition as Automobile["condition"]) ?? "Used",
  type: (r.type as Automobile["type"]) ?? "Car",
  image: String(r.image ?? ""),
  seller: String(r.seller ?? ""),
  postedAgo: String(r.posted_ago ?? ""),
  phone: r.phone ? String(r.phone) : undefined,
  verified: Boolean(r.verified),
  ownerId: r.owner_id ? String(r.owner_id) : undefined,
  fromBackend: true,
});
