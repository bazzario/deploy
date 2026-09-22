-- Bazaario — admin setup fix for public.profiles.
--
-- Run this once in your Supabase project's SQL editor (Project -> SQL Editor).
-- Safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.
--
-- Scope: ONLY public.profiles (its columns, its auth-user trigger, its RLS
-- policies). It does not touch products, used_items, automobiles, orders,
-- seller_payments, or any other table, and does not change the UI.
--
-- This file is self-contained: it works whether or not
-- supabase/seller-ownership.sql has already been run, and it never uses the
-- service_role / sb_secret key or a hardcoded password anywhere.

-- ---------------------------------------------------------------------------
-- 1. public.profiles — create it if it doesn't exist yet (fresh project),
--    or fix it if it already exists with fewer columns (e.g. only
--    id / is_admin / created_at from an older seller-ownership.sql run).
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  is_admin boolean not null default false,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Add any columns that are missing on a pre-existing profiles table.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 2. Auth-user -> profile trigger. Auto-creates (or fills in) a profile row
--    whenever a new user signs up, copying their email and full name across.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 3. Backfill: fill in email / full_name for any profile rows that already
--    existed before this file added those columns (e.g. users who signed up
--    back when handle_new_user() only inserted `id`).
-- ---------------------------------------------------------------------------

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null
  and u.email is not null;

update public.profiles p
set full_name = coalesce(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
where u.id = p.id
  and (p.full_name is null or p.full_name = '')
  and coalesce(u.raw_user_meta_data ->> 'full_name', '') <> '';

-- Make sure every existing auth user has a profile row at all (in case a
-- user was created before any trigger existed).
insert into public.profiles (id, email, full_name, created_at)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', ''), u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security — kept enabled, existing policy preserved, admin
--    read/update policies added so the admin panel can eventually list and
--    manage users without exposing profiles to other regular users.
--
--    IMPORTANT: a policy ON public.profiles must not query public.profiles
--    directly — Postgres rejects that with "infinite recursion detected in
--    policy for relation profiles", which would make every profiles lookup
--    (including the app's own is_admin / is_blocked check at login) fail.
--    The admin test therefore lives in a SECURITY DEFINER function, which
--    reads the table without re-entering RLS.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- true only for a signed-in user whose profile has is_admin = true and is
-- NOT blocked. Uses no secret key; it runs with the function owner's rights.
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin
      and not is_blocked
  );
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

-- Every signed-in user can read their own row (unchanged from before). The app
-- uses this to read is_admin and is_blocked right after Supabase Auth login.
drop policy if exists "profiles: read own row" on public.profiles;
create policy "profiles: read own row"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can read every profile (needed for a future admin users screen).
drop policy if exists "profiles: admin read all" on public.profiles;
create policy "profiles: admin read all"
  on public.profiles for select
  using (public.is_current_user_admin());

-- Admins can update other users' rows (e.g. to block a user or grant admin).
-- Regular users get no update policy here, so they cannot self-promote to
-- admin or unblock themselves via the REST API.
drop policy if exists "profiles: admin update" on public.profiles;
create policy "profiles: admin update"
  on public.profiles for update
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- No admin password, service_role key, or sb_secret key is used anywhere in
-- this file. To make an account an admin, see ADMIN_SETUP.md.
