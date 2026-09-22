import { useEffect, useRef, useState } from "react";
import { useAuth } from "../store/AuthStore";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  subscribeSellerNotifications,
  type NotificationEvent,
  type RealtimeState,
} from "../lib/realtime";

interface Handlers {
  /** A notification row for the signed-in seller was inserted or updated. */
  onEvent: (event: NotificationEvent) => void;
  /**
   * The channel (re)joined. Events sent while it was down are not replayed, so the
   * caller should silently re-read whatever it displays.
   */
  onResync: () => void;
}

/**
 * Keeps ONE realtime subscription open for the signed-in seller while the calling
 * component is mounted, and closes it on unmount.
 *
 *  - The effect depends only on the seller id (and whether a token exists), never
 *    on the token itself: the token rotates about every 40 minutes and must not
 *    tear the subscription down. New tokens are pushed to the open socket instead.
 *  - Handlers are read through a ref, so re-rendering never resubscribes.
 *  - If realtime can't connect the state becomes "unavailable" and nothing else
 *    changes: the normal REST loading in the caller keeps working.
 */
export function useSellerNotifications(handlers: Handlers): RealtimeState {
  const { user, accessToken } = useAuth();
  const sellerId = user?.id ?? null;
  const hasToken = Boolean(accessToken);

  const [state, setState] = useState<RealtimeState>(isSupabaseConfigured ? "connecting" : "unavailable");

  const handlersRef = useRef(handlers);
  const tokenRef = useRef<string | undefined>(accessToken ?? undefined);
  const setAuthRef = useRef<((token: string) => void) | null>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    tokenRef.current = accessToken ?? undefined;
    if (accessToken) setAuthRef.current?.(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (!isSupabaseConfigured || !sellerId || !hasToken) return;

    const subscription = subscribeSellerNotifications({
      sellerId,
      getAccessToken: () => tokenRef.current,
      onEvent: (event) => handlersRef.current.onEvent(event),
      onState: (next) => {
        setState(next);
        if (next === "live") handlersRef.current.onResync();
      },
    });
    setAuthRef.current = subscription.setAuth;

    return () => {
      setAuthRef.current = null;
      subscription.unsubscribe();
    };
  }, [sellerId, hasToken]);

  return isSupabaseConfigured && sellerId && hasToken ? state : "unavailable";
}
