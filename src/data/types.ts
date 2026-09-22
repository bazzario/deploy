export interface Product {
  id: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  /** Primary image. Always equal to `images[0]` when `images` is set. */
  image: string;
  /**
   * All product images in display order — the first one is the primary image.
   * Optional: products created before multi-image support only have `image`
   * (use `getProductImages()` from lib/productImages to read either shape).
   */
  images?: string[];
  badge?: "New" | "Bestseller" | "Limited";
  freeDelivery?: boolean;
  /** Units available. `undefined` = stock isn't tracked for this product (treated as available). */
  stock?: number;
  ownerId?: string;
  fromBackend?: boolean;
}

export interface UsedItem {
  id: string;
  title: string;
  price: number;
  negotiable: boolean;
  condition: "New" | "Like New" | "Used - Good" | "Used - Fair";
  location: string;
  seller: string;
  sellerRating: number;
  postedAgo: string;
  image: string;
  category: string;
  description: string;
  /** International format, e.g. "+923001234567". Khaali = contact buttons hide. */
  phone?: string;
  /** Sirf tab true karein jab seller ka ID/verification actually check kiya ho. */
  verified?: boolean;
  ownerId?: string;
  fromBackend?: boolean;
}

export interface Automobile {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileageKm: number;
  fuel: "Petrol" | "Diesel" | "Hybrid" | "Electric";
  transmission: "Manual" | "Automatic";
  location: string;
  condition: "New" | "Used";
  type: "Car" | "Bike" | "SUV" | "Truck" | "Van" | "Auto Part";
  image: string;
  seller: string;
  postedAgo: string;
  /** International format, e.g. "+923001234567". Khaali = call/message buttons hide. */
  phone?: string;
  /** Sirf tab true karein jab dealer verification actually ho chuki ho. */
  verified?: boolean;
  ownerId?: string;
  fromBackend?: boolean;
}
