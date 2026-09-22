export function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-PK")}`;
}

export function formatKm(km: number): string {
  if (km === 0) return "0 km";
  return `${km.toLocaleString("en-PK")} km`;
}

export function discountPercent(price: number, original?: number): number | null {
  if (!original || original <= price) return null;
  return Math.round(((original - price) / original) * 100);
}
