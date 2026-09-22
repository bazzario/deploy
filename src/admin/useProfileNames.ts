import { useEffect, useState } from "react";
import { db, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../store/AuthStore";

/**
 * Maps profiles.id -> a readable label (full name, else email). Admins can read
 * every profile through the "profiles: admin read all" RLS policy. If the read
 * fails (policy / columns missing) the map stays empty and callers fall back to
 * showing nothing rather than inventing a name.
 */
export function useProfileNames(): Map<string, string> {
  const { accessToken } = useAuth();
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!isSupabaseConfigured || !accessToken) return;
    let cancelled = false;
    db.select<{ id: string; email?: string | null; full_name?: string | null }[]>(
      "profiles",
      "select=id,email,full_name",
      accessToken
    )
      .then((rows) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const r of rows ?? []) map.set(r.id, r.full_name?.trim() || r.email || "");
        setNames(map);
      })
      .catch(() => {
        /* leave the map empty */
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return names;
}
