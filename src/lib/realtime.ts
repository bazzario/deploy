/**
 * Supabase Realtime subscription for the seller dashboard.
 *
 * What is subscribed to: INSERT/UPDATE on `public.seller_order_notifications`,
 * filtered to `seller_id=eq.<me>`. Sellers never subscribe to `public.orders`
 * (a payload there would contain every seller's items and the buyer's details).
 * A notification row holds only this seller's own share of the order, and its Row
 * Level Security policy (`seller_id = auth.uid()`) means Realtime only delivers
 * rows to the seller they belong to — the `filter` below is a second, redundant
 * narrowing, not the security boundary.
 *
 * One call = one client = one channel. The caller MUST call `unsubscribe()` on
 * cleanup (a React effect cleanup does), which removes the channel and closes the
 * socket, so remounting never leaves a duplicate subscription behind. Dropped
 * connections are re-established by realtime-js itself; every (re)join reports
 * "subscribed" again so the caller can resync anything it missed while offline.
 */
import { RealtimeClient } from "@supabase/realtime-js";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";
import { isUuid } from "./ids";
import { notificationFromRow, type SellerNotification } from "./sellerNotifications";

export type RealtimeState = "connecting" | "live" | "unavailable";

export interface NotificationEvent {
  type: "INSERT" | "UPDATE";
  notification: SellerNotification;
}

export interface SellerNotificationSubscription {
  /** Give the open socket a fresh access token (they rotate roughly hourly). */
  setAuth: (accessToken: string) => void;
  unsubscribe: () => void;
}

interface Options {
  sellerId: string;
  /** Current access token; read on every (re)connect so rotation is picked up. */
  getAccessToken: () => string | undefined;
  onEvent: (event: NotificationEvent) => void;
  onState: (state: RealtimeState) => void;
}

interface RawChange {
  eventType: string;
  new: unknown;
}

const NOOP: SellerNotificationSubscription = { setAuth: () => {}, unsubscribe: () => {} };

export function subscribeSellerNotifications(options: Options): SellerNotificationSubscription {
  const { sellerId, getAccessToken, onEvent, onState } = options;

  if (!isSupabaseConfigured || !isUuid(sellerId)) {
    onState("unavailable");
    return NOOP;
  }

  let client: RealtimeClient;
  try {
    client = new RealtimeClient(`${SUPABASE_URL.replace(/^http/i, "ws")}/realtime/v1`, {
      params: { apikey: SUPABASE_ANON_KEY },
      accessToken: async () => getAccessToken() ?? null,
    });
  } catch (err) {
    console.error("Realtime could not start:", err);
    onState("unavailable");
    return NOOP;
  }

  let closed = false;
  const report = (state: RealtimeState) => {
    if (!closed) onState(state);
  };

  onState("connecting");

  const channel = client
    .channel(`seller-order-notifications:${sellerId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "seller_order_notifications",
        filter: `seller_id=eq.${sellerId}`,
      },
      (payload: RawChange) => {
        if (closed) return;
        if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") return;
        const notification = notificationFromRow(payload.new);
        // Defence in depth: never act on a row that isn't ours, whatever arrives.
        if (!notification || notification.sellerId !== sellerId) return;
        onEvent({ type: payload.eventType, notification });
      }
    )
    .subscribe((status: string, err?: Error) => {
      if (status === "SUBSCRIBED") {
        report("live");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (err) console.warn("Realtime channel problem:", err.message);
        report("unavailable");
      } else if (status === "CLOSED") {
        report("connecting");
      }
    });

  return {
    setAuth: (accessToken) => {
      if (closed) return;
      void Promise.resolve(client.setAuth(accessToken)).catch((err: unknown) =>
        console.warn("Realtime token refresh failed:", err)
      );
    },
    unsubscribe: () => {
      if (closed) return;
      closed = true;
      try {
        void Promise.resolve(client.removeChannel(channel)).catch(() => {});
        void Promise.resolve(client.disconnect()).catch(() => {});
      } catch {
        // Already torn down — nothing left to clean up.
      }
    },
  };
}
