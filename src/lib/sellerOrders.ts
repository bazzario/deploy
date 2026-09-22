/**
 * Read side of the seller dashboard's Orders section.
 *
 * Which orders a seller may see, and which lines of them, is decided by the
 * database — not by this file. Sellers read the view `public.seller_orders`
 * (supabase/orders.sql), which:
 *   - identifies the caller by `auth.uid()` from the verified token, so nothing in
 *     these requests (no seller id, no query-string value) can widen the result;
 *   - returns only orders whose `seller_ids` contain the caller;
 *   - returns `items` already reduced to the caller's own lines, so another
 *     seller's lines in a multi-seller order never reach the browser;
 *   - does not expose `total`, `subtotal`, `delivery`, `buyer_id` or `seller_ids`.
 *
 * The React-side check below (`line.sellerId === sellerId`) is display logic on top
 * of that, not the security boundary.
 */
import { db } from "./supabase";
import { normalizeOrderLine, type Order, type OrderLine, type StoredOrderLine } from "../store/OrdersStore";

export interface SellerOrder {
  id: string;
  createdAt: string;
  status: Order["status"];
  paymentMethod: string;
  /** Delivery contact the buyer entered at checkout. */
  buyer: Order["customer"];
  /** Only the lines that belong to the signed-in seller. */
  lines: OrderLine[];
  /** Sum of price × qty over `lines` — this seller's share, not the order total. */
  subtotal: number;
}

export const SELLER_ORDER_COLUMNS = "id,created_at,status,items,customer,payment_method";

type Row = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === "string" ? value : "");

function isRecord(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Turns one `seller_orders` row into a seller's view of it: only that seller's lines and
 * their subtotal. Returns null when no line belongs to `sellerId` (nothing of
 * that order is shown, including the buyer's details).
 */
export function sellerOrderFromRow(row: Row, sellerId: string): SellerOrder | null {
  const rawItems: unknown[] = Array.isArray(row.items) ? row.items : [];

  const lines = rawItems
    .filter(isRecord)
    .map((item) => normalizeOrderLine(item as unknown as StoredOrderLine))
    .filter((line) => line.sellerId === sellerId)
    .map((line) => ({ ...line, price: Number(line.price) || 0, qty: Number(line.qty) || 0 }));

  if (lines.length === 0) return null;

  const customer = isRecord(row.customer) ? row.customer : {};

  return {
    id: String(row.id),
    createdAt: text(row.created_at) || new Date().toISOString(),
    status: (row.status as Order["status"]) ?? "Placed",
    paymentMethod: text(row.payment_method),
    buyer: {
      name: text(customer.name),
      phone: text(customer.phone),
      email: text(customer.email),
      address: text(customer.address),
      city: text(customer.city),
      notes: text(customer.notes),
    },
    lines,
    subtotal: lines.reduce((sum, line) => sum + line.price * line.qty, 0),
  };
}

/** The view sellers read. Rows are scoped to the signed-in seller by the database. */
export const SELLER_ORDERS_VIEW = "seller_orders";

export function buildSellerOrdersQuery(page: { limit: number; offset: number }): string {
  return [
    `select=${SELLER_ORDER_COLUMNS}`,
    "order=created_at.desc",
    `limit=${page.limit}`,
    `offset=${page.offset}`,
  ].join("&");
}

export function buildSellerOrderQuery(orderId: string): string {
  return [`select=${SELLER_ORDER_COLUMNS}`, `id=eq.${encodeURIComponent(orderId)}`, "limit=1"].join("&");
}

export interface SellerOrdersPage {
  orders: SellerOrder[];
  /** Rows the server returned for this page (before any line filtering). */
  rowCount: number;
}

export async function fetchSellerOrders(
  sellerId: string,
  accessToken: string,
  page: { limit: number; offset: number }
): Promise<SellerOrdersPage> {
  const rows = await db.select<Row[]>(SELLER_ORDERS_VIEW, buildSellerOrdersQuery(page), accessToken);
  const list = rows ?? [];
  const orders = list
    .map((row) => sellerOrderFromRow(row, sellerId))
    .filter((order): order is SellerOrder => order !== null);
  return { orders, rowCount: list.length };
}

/** Exact number of this seller's orders (a HEAD count, so it isn't capped by the page size). */
export function fetchSellerOrderCount(accessToken: string): Promise<number> {
  return db.count(SELLER_ORDERS_VIEW, "", accessToken);
}

/** One order, only if it contains this seller's products; otherwise null. */
export async function fetchSellerOrder(
  sellerId: string,
  orderId: string,
  accessToken: string
): Promise<SellerOrder | null> {
  const rows = await db.select<Row[]>(SELLER_ORDERS_VIEW, buildSellerOrderQuery(orderId), accessToken);
  const row = (rows ?? [])[0];
  return row ? sellerOrderFromRow(row, sellerId) : null;
}

export function describeSellerOrdersError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Could not load your orders.";
  return /seller_orders/i.test(message)
    ? `${message}; run the latest supabase/orders.sql in your Supabase project.`
    : message;
}
