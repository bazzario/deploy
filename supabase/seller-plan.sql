-- Bazaario — seller free listing period (12 months) + seller terms acceptance.
--
-- Run this ONCE in your Supabase project's SQL editor, AFTER seller-ownership.sql.
-- Safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.
--
-- Scope: this file ONLY adds columns to the existing public.profiles table and
-- one helper function. It does not touch products, used_items, automobiles,
-- orders, or auth — and it creates no new user/auth table.
--
-- Rule implemented:
--   A new seller lists for free for the first 12 months, counted from the
--   EXISTING profiles.created_at date. After 12 months a paid seller plan is
--   required to publish new listings. The fee is not decided yet, so no price
--   is stored anywhere here.

-- 1. New columns on public.profiles (the table that already exists).

-- Optional manual override for the free-period start date. NULL (the normal
-- case) means the app uses profiles.created_at — the account creation date.
alter table public.profiles
  add column if not exists seller_free_start timestamptz;

-- 'free'  = inside the 12-month free window (default for everyone)
-- 'paid'  = a paid seller plan has been recorded for this seller
-- The app treats 'paid' as active only while seller_plan_paid_until is in the
-- future, so an expired paid plan falls back to the renewal message.
alter table public.profiles
  add column if not exists seller_plan_status text not null default 'free';

-- Paid plan expiry. Stays NULL until a real payment is recorded by the
-- payment gateway integration. Nothing in the app writes this value today.
alter table public.profiles
  add column if not exists seller_plan_paid_until timestamptz;

-- When the seller accepted the Seller Terms. NULL = not accepted yet.
alter table public.profiles
  add column if not exists seller_terms_accepted_at timestamptz;

-- Allowed values for seller_plan_status (keeps bad data out).
alter table public.profiles drop constraint if exists profiles_seller_plan_status_check;
alter table public.profiles
  add constraint profiles_seller_plan_status_check
  check (seller_plan_status in ('free', 'paid'));

-- 2. Backfill: make sure every existing auth user has a profile row, otherwise
-- the app cannot read their account creation date and will block listing.
-- created_at is taken from the auth user so an existing seller's free period
-- is counted from when they actually signed up, not from today.
insert into public.profiles (id, created_at)
select u.id, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 3. Accepting the Seller Terms.
--
-- A plain "update own row" RLS policy is deliberately NOT used here: it would
-- let a seller PATCH their own is_admin / seller_plan_paid_until columns.
-- This security-definer function lets a signed-in user set exactly one column
-- on exactly their own row, and nothing else.
create or replace function public.accept_seller_terms()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  update public.profiles
     set seller_terms_accepted_at = coalesce(seller_terms_accepted_at, accepted_at)
   where id = auth.uid();

  return accepted_at;
end;
$$;

revoke all on function public.accept_seller_terms() from public;
grant execute on function public.accept_seller_terms() to authenticated;

-- 4. Recording a paid renewal (manual, until a real payment gateway is added).
-- There is intentionally NO app code and NO fake payment screen that writes
-- these values. When a real online payment to Bazaario is confirmed, the
-- gateway webhook (or an admin) sets them:
--
--   update public.profiles
--      set seller_plan_status = 'paid',
--          seller_plan_paid_until = now() + interval '12 months'
--    where id = '<user-uuid>';
--
-- To give a specific seller a different free-period start date:
--
--   update public.profiles
--      set seller_free_start = '2026-01-01'
--    where id = '<user-uuid>';

-- 5. OPTIONAL — database-level enforcement.
--
-- The app already blocks new listings once the free period ends. The policies
-- below repeat that rule inside the database, so the restriction also holds if
-- someone calls the REST API directly. They are left commented out because
-- they REPLACE the existing insert policies from seller-ownership.sql — review
-- them before running, and run all three together.
--
-- drop policy if exists "products: insert own" on public.products;
-- create policy "products: insert own" on public.products
--   for insert with check (
--     exists (select 1 from public.profiles where id = auth.uid() and is_admin)
--     or (
--       auth.uid() = owner_id
--       and exists (
--         select 1 from public.profiles p
--         where p.id = auth.uid()
--           and p.seller_terms_accepted_at is not null
--           and (
--             coalesce(p.seller_free_start, p.created_at) + interval '12 months' > now()
--             or (p.seller_plan_status = 'paid' and p.seller_plan_paid_until > now())
--           )
--       )
--     )
--   );
--
-- drop policy if exists "used_items: insert own" on public.used_items;
-- create policy "used_items: insert own" on public.used_items
--   for insert with check (
--     exists (select 1 from public.profiles where id = auth.uid() and is_admin)
--     or (
--       auth.uid() = owner_id
--       and exists (
--         select 1 from public.profiles p
--         where p.id = auth.uid()
--           and p.seller_terms_accepted_at is not null
--           and (
--             coalesce(p.seller_free_start, p.created_at) + interval '12 months' > now()
--             or (p.seller_plan_status = 'paid' and p.seller_plan_paid_until > now())
--           )
--       )
--     )
--   );
--
-- drop policy if exists "automobiles: insert own" on public.automobiles;
-- create policy "automobiles: insert own" on public.automobiles
--   for insert with check (
--     exists (select 1 from public.profiles where id = auth.uid() and is_admin)
--     or (
--       auth.uid() = owner_id
--       and exists (
--         select 1 from public.profiles p
--         where p.id = auth.uid()
--           and p.seller_terms_accepted_at is not null
--           and (
--             coalesce(p.seller_free_start, p.created_at) + interval '12 months' > now()
--             or (p.seller_plan_status = 'paid' and p.seller_plan_paid_until > now())
--           )
--       )
--     )
--   );
