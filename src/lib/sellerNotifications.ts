/**
 * Per-seller unread / read state for orders, backed by
 * `public.seller_order_notifications` (supabase/seller-notifications.sql).
 *
 * One row per (order, seller). `read_at IS NULL` means unread. Row Level Security
 * lets a seller SELECT only rows where `seller_id = auth.uid()`, and the table has
 * no client write access at all: rows are created by a database trigger from the
 * seller ids the database itself stamped on the order, and marked read by
 * `mark_seller_order_read()`, which acts on `auth.uid()` only.
 *
 * So nothing here can name another seller: no request below carries a seller id
 * that the database trusts. Where `seller_id=eq.<me>` appears it is only a
 * redundant narrowing of what RLS already restricts to the caller.
 */
import { db } from "./supabase";
import { isUuid } from "./ids";

/**
 * A notification carries only this seller's own share of an order (line count,
 * quantity, subtotal) — never buyer details or items.
 */
export interface SellerNotification {
  orderId: string;
  sellerId: string;
  createdAt: string;
  /** null = unread. */
  readAt: string | null;
  lineCount: number;
  itemQty: number;
  subtotal: number;
}

type Row = Record<string, unknown>;

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Validates an untrusted row (REST or realtime payload); null when it isn't one. */
export function notificationFromRow(row: unknown): SellerNotification | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Row;
  if (typeof r.order_id !== "string" || r.order_id === "") return null;
  if (typeof r.seller_id !== "string" || r.seller_id === "") return null;
  return {
    orderId: r.order_id,
    sellerId: r.seller_id,
    createdAt: typeof r.created_at === "string" ? r.created_at : new Date().toISOString(),
    readAt: typeof r.read_at === "string" ? r.read_at : null,
    lineCount: num(r.line_count),
    itemQty: num(r.item_qty),
    subtotal: num(r.subtotal),
  };
}

export interface UnreadState {
  /** Exact number of unread orders (not capped by the id list size). */
  count: number;
  /** Most recent unread order ids — used to badge cards in the list. */
  ids: string[];
}

const UNREAD_ID_LIMIT = 500;

/**
 * The signed-in seller's unread orders. Both requests are RLS-scoped to the
 * caller; the count is a HEAD request so it is exact even beyond the id list.
 */
export async function fetchUnread(sellerId: string, accessToken: string): Promise<UnreadState> {
  if (!isUuid(sellerId)) throw new Error("Your account id is not valid, so notifications can't be loaded.");
  const filter = `seller_id=eq.${sellerId}&read_at=is.null`;
  const [count, rows] = await Promise.all([
    db.count("seller_order_notifications", filter, accessToken),
    db.select<Row[]>(
      "seller_order_notifications",
      `select=order_id&${filter}&order=created_at.desc&limit=${UNREAD_ID_LIMIT}`,
      accessToken
    ),
  ]);
  const ids = (rows ?? []).map((r) => r.order_id).filter((id): id is string => typeof id === "string");
  return { count, ids };
}

/**
 * Marks the signed-in seller's notification for ONE order as read. Other sellers
 * of the same order are untouched. Resolves true when it changed something, false
 * when there was nothing to change (already read, or a legacy order that has no
 * notification row).
 */
export async function markOrderRead(orderId: string, accessToken: string): Promise<boolean> {
  const result = await db.insert<boolean>("rpc/mark_seller_order_read", { p_order_id: orderId }, accessToken);
  return result === true;
}
