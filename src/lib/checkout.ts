import { site } from "../config/site";
import type { Product } from "../data/types";

export interface CheckoutItem {
  product: Product;
  qty: number;
}

/** Stock ka pata na ho to yeh default max quantity per order use hoti hai. */
export const DEFAULT_MAX_QTY = 10;

/** Product ke stock field ke hisaab se maximum kitni quantity order ki ja sakti hai. */
export function maxOrderableQty(product: Product): number {
  if (product.stock === undefined) return DEFAULT_MAX_QTY;
  return Math.max(0, Math.min(product.stock, DEFAULT_MAX_QTY));
}

export function isOutOfStock(product: Product): boolean {
  return product.stock !== undefined && product.stock <= 0;
}

export function calcTotals(items: CheckoutItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const { freeDeliveryOver, deliveryFee } = site.policies;

  let delivery = 0;
  if (subtotal > 0) {
    const qualifiesForFree = freeDeliveryOver !== null && subtotal >= freeDeliveryOver;
    delivery = qualifiesForFree ? 0 : deliveryFee;
  }

  return { subtotal, delivery, total: subtotal + delivery };
}
