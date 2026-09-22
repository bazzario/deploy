/**
 * Loading the signed-in seller's own `public.profiles` row (free-period start,
 * plan, terms) — and repairing it when the row is missing.
 *
 * Why this exists: the row used to be created only by the `on_auth_user_created`
 * database trigger, which fires for accounts created AFTER it was installed. An
 * older account (or one created while the trigger was missing) had no row, the
 * query returned nothing, and the dashboard said "Your seller profile could not be
 * loaded". `ensure_my_profile()` (supabase/seller-profile-fix.sql) creates the
 * missing row on the server.
 *
 * Nothing here trusts a client-supplied identity:
 *   - the plain read is filtered by Row Level Security (`auth.uid() = id`), so a
 *     wrong id can only ever return nothing;
 *   - the repair RPC takes NO id at all — the database uses the verified token's
 *     `auth.uid()`.
 */
import { db, SupabaseError } from "./supabase";

export type ProfileRow = Record<string, unknown>;

const PLAN_COLUMNS =
  "created_at,seller_free_start,seller_plan_status,seller_plan_paid_until,seller_terms_accepted_at";

/**
 * The signed-in user's own profile row, or undefined when there is none (or RLS
 * hides it). Falls back to `created_at` alone when supabase/seller-plan.sql hasn't
 * been run yet, so existing sellers aren't blocked by a missing migration.
 */
export async function readOwnProfile(
  userId: string,
  accessToken: string | undefined
): Promise<ProfileRow | undefined> {
  const id = encodeURIComponent(userId);
  let rows: ProfileRow[] | null;
  try {
    rows = await db.select<ProfileRow[]>("profiles", `select=${PLAN_COLUMNS}&id=eq.${id}`, accessToken);
  } catch {
    rows = await db.select<ProfileRow[]>("profiles", `select=created_at&id=eq.${id}`, accessToken);
  }
  return rows?.[0];
}

/**
 * Asks the database to create the caller's profile row if it is missing, and
 * returns it. Requires the token of the signed-in user (an anonymous call is
 * refused by the database).
 */
export async function ensureOwnProfile(accessToken: string | undefined): Promise<ProfileRow | undefined> {
  const rows = await db.insert<ProfileRow[]>("rpc/ensure_my_profile", {}, accessToken);
  return Array.isArray(rows) ? rows[0] : undefined;
}

/** True when PostgREST says the repair function isn't installed (migration not run). */
export function isRepairFunctionMissing(err: unknown): boolean {
  return err instanceof SupabaseError && err.status === 404;
}

export const PROFILE_MISSING_MESSAGE =
  "Your seller profile could not be loaded. Please contact support.";

export const PROFILE_MIGRATION_MESSAGE =
  "Your seller profile could not be loaded because the database setup is out of date. " +
  "Run supabase/seller-profile-fix.sql in your Supabase project, then reload this page.";
