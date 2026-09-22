-- Bazaario — minimal Supabase setup for the seller/admin ownership model.
-- Run this once in your Supabase project's SQL editor.
-- Scope: ONLY what /sell, /seller and /admin need — no unrelated schema changes.
--
-- Safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE.

-- 1. profiles table — already referenced by src/store/AuthStore.tsx (is_admin check).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own row" on public.profiles;
create policy "profiles: read own row"
  on public.profiles for select
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- To make an account an admin, run manually (never hardcode this in the app):
--   update public.profiles set is_admin = true where id = '<user-uuid-from-auth.users>';

-- 2. Listing tables — created only if they don't already exist, with the exact
-- columns src/store/ListingsStore.tsx reads/writes. If you already created these
-- tables yourself with matching columns, these statements are no-ops.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  brand text not null default '',
  category text not null default '',
  price numeric not null default 0,
  original_price numeric,
  rating numeric not null default 0,
  reviews integer not null default 0,
  image text not null default '',
  badge text,
  free_delivery boolean not null default false,
  stock integer,
  owner_id uuid,
  created_at timestamptz not null default now()
);

-- Stock tracking (units available). NULL = stock isn't tracked for this product.
alter table public.products add column if not exists stock integer;

create table if not exists public.used_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  price numeric not null default 0,
  negotiable boolean not null default true,
  condition text not null default 'Used - Good',
  location text not null default '',
  seller text not null default '',
  seller_rating numeric not null default 0,
  posted_ago text not null default 'Just now',
  image text not null default '',
  category text not null default '',
  description text not null default '',
  phone text,
  verified boolean not null default false,
  owner_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.automobiles (
  id uuid primary key default gen_random_uuid(),
  make text not null,
  model text not null default '',
  year integer not null default extract(year from now()),
  price numeric not null default 0,
  mileage_km integer not null default 0,
  fuel text not null default 'Petrol',
  transmission text not null default 'Manual',
  location text not null default '',
  condition text not null default 'Used',
  type text not null default 'Car',
  image text not null default '',
  seller text not null default '',
  posted_ago text not null default 'Just now',
  phone text,
  verified boolean not null default false,
  owner_id uuid,
  created_at timestamptz not null default now()
);

-- owner_id column on each listing table, so a seller can be tied to their listings.
-- (add column if not exists covers the case where the tables already existed
-- before this file was introduced.)
alter table public.products      add column if not exists owner_id uuid references auth.users (id) on delete set null;
alter table public.used_items    add column if not exists owner_id uuid references auth.users (id) on delete set null;
alter table public.automobiles   add column if not exists owner_id uuid references auth.users (id) on delete set null;

-- 3. Row Level Security on listing tables.
alter table public.products    enable row level security;
alter table public.used_items  enable row level security;
alter table public.automobiles enable row level security;

-- Everyone (including logged-out visitors) can browse listings.
drop policy if exists "products: public read" on public.products;
create policy "products: public read" on public.products for select using (true);

drop policy if exists "used_items: public read" on public.used_items;
create policy "used_items: public read" on public.used_items for select using (true);

drop policy if exists "automobiles: public read" on public.automobiles;
create policy "automobiles: public read" on public.automobiles for select using (true);

-- Any signed-in user can create a listing, as long as they own it.
-- Admins can also insert (e.g. from the Admin panel), matching the
-- update/delete policies below — otherwise admin-created listings would be
-- rejected because they don't set owner_id to their own uid by default.
drop policy if exists "products: insert own" on public.products;
create policy "products: insert own" on public.products
  for insert with check (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "used_items: insert own" on public.used_items;
create policy "used_items: insert own" on public.used_items
  for insert with check (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "automobiles: insert own" on public.automobiles;
create policy "automobiles: insert own" on public.automobiles
  for insert with check (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- A seller can update/delete only their own listings; an admin can manage any listing.
drop policy if exists "products: modify own or admin" on public.products;
create policy "products: modify own or admin" on public.products
  for update using (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "products: delete own or admin" on public.products;
create policy "products: delete own or admin" on public.products
  for delete using (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "used_items: modify own or admin" on public.used_items;
create policy "used_items: modify own or admin" on public.used_items
  for update using (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "used_items: delete own or admin" on public.used_items;
create policy "used_items: delete own or admin" on public.used_items
  for delete using (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "automobiles: modify own or admin" on public.automobiles;
create policy "automobiles: modify own or admin" on public.automobiles
  for update using (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "automobiles: delete own or admin" on public.automobiles;
create policy "automobiles: delete own or admin" on public.automobiles
  for delete using (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- Note: the create table statements above only run if these tables don't
-- already exist. If you already have public.products / public.used_items /
-- public.automobiles with different column names, adjust them to match
-- src/store/ListingsStore.tsx (title, price, image, owner_id, etc) before
-- running this file.
