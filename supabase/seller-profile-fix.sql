-- Bazaario — fix: "Your seller profile could not be loaded. Please contact support."
--
-- Run this ONCE in your Supabase project's SQL editor. Safe to re-run: every
-- statement is IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS, and it only ever
-- INSERTS missing profile rows — it never changes an existing one.
--
-- Scope: ONLY public.profiles (missing rows, the signup trigger, the "read own
-- row" policy) plus one function, public.ensure_my_profile(). It does not touch
-- products, used_items, automobiles, orders or any other table.
--
-- WHY THE ERROR HAPPENED
--   The app reads the seller's row in public.profiles (free-listing start date,
--   plan, terms). Nothing but the `on_auth_user_created` trigger ever created that
--   row, and the trigger only fires for accounts created AFTER it was installed.
--   supabase/seller-ownership.sql (the prerequisite of orders.sql) installs the
--   trigger but has NO backfill, so any account that already existed — or that was
--   created while the trigger was missing/broken — has no profiles row. The query
--   then returns zero rows and the dashboard shows the error.
--
-- WHAT THIS FILE DOES
--   1. Makes sure the profiles columns the app uses exist.
--   2. Backfills the missing rows for every existing auth user (dates are copied
--      from auth.users, so a seller's free period counts from real sign-up).
--   3. Re-installs the signup trigger so new accounts always get a row.
--   4. Re-asserts the "read own row" policy (own row only — nothing wider).
--   5. Adds public.ensure_my_profile(): the app calls it when it finds no row.
--      It works from auth.uid() ONLY (the caller's verified JWT), takes no id
--      parameter, never sets is_admin, and never touches anyone else's row.

-- 1. Columns (no-ops when supabase/admin-setup.sql / seller-plan.sql already ran).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  is_admin boolean not null default false,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists seller_free_start timestamptz;
alter table public.profiles add column if not exists seller_plan_status text not null default 'free';
alter table public.profiles add column if not exists seller_plan_paid_until timestamptz;
alter table public.profiles add column if not exists seller_terms_accepted_at timestamptz;

-- 2. Backfill: a profile row for every auth user that has none.
insert into public.profiles (id, email, full_name, created_at)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', ''), u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 3. Signup trigger: every new account gets its row (same as admin-setup.sql).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email     = coalesce(public.profiles.email, excluded.email),
        full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. RLS: a signed-in user can read ONLY their own profile row. Other policies
--    on this table (e.g. the admin ones from admin-setup.sql) are left alone.
alter table public.profiles enable row level security;

drop policy if exists "profiles: read own row" on public.profiles;
create policy "profiles: read own row"
  on public.profiles for select
  using (auth.uid() = id);

-- 5. Self-heal for accounts that still have no row (e.g. the trigger failed).
--
-- SECURITY DEFINER because a signed-in user has no INSERT policy on profiles
-- (and must not get one: it would let them write is_admin). The function is
-- narrow by construction:
--   * the row it creates/returns is decided by auth.uid(), i.e. the verified
--     token — there is no user-id argument the client could forge;
--   * it copies email / name / created_at from auth.users and leaves every
--     other column at its default (is_admin = false, is_blocked = false);
--   * it is INSERT ... ON CONFLICT DO NOTHING, so an existing row (including an
--     admin or blocked account) is never modified;
--   * only signed-in users may execute it (anon is revoked).
create or replace function public.ensure_my_profile()
returns table (
  created_at timestamptz,
  seller_free_start timestamptz,
  seller_plan_status text,
  seller_plan_paid_until timestamptz,
  seller_terms_accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  insert into public.profiles (id, email, full_name, created_at)
  select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', ''), u.created_at
  from auth.users u
  where u.id = v_uid
  on conflict (id) do nothing;

  return query
    select p.created_at,
           p.seller_free_start,
           p.seller_plan_status,
           p.seller_plan_paid_until,
           p.seller_terms_accepted_at
    from public.profiles p
    where p.id = v_uid;
end;
$$;

-- Supabase grants EXECUTE on new functions to anon and authenticated by default;
-- "from public" alone would leave anon with it.
revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- Optional checks (run manually):
--
--   -- accounts without a profile row (should now be zero rows):
--   select u.id, u.email from auth.users u
--   left join public.profiles p on p.id = u.id where p.id is null;
--
--   -- who owns which listings (compare with the seller's auth.users id):
--   select owner_id, count(*) from public.products    group by owner_id;
--   select owner_id, count(*) from public.used_items  group by owner_id;
--   select owner_id, count(*) from public.automobiles group by owner_id;
-- ---------------------------------------------------------------------------
