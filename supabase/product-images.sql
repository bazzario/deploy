-- Bazaario — multi-image product listings backed by Supabase Storage.
--
-- Run this once in your Supabase project's SQL editor (Project -> SQL Editor).
-- Safe to re-run: every statement is idempotent.
--
-- Scope: public.products (one new column + a sync trigger) and the
-- "product-images" Storage bucket with its access policies. It does not touch
-- any other table and never uses the service_role key.
--
-- Requires supabase/seller-ownership.sql to have been run first (it creates
-- public.products, public.profiles and the owner_id column used below).
--
-- BUCKET NAME: this file uses the bucket id  product-images.
-- If you already have a bucket you want to use instead, find/replace
-- 'product-images' in this file with your bucket id, and set
-- VITE_SUPABASE_PRODUCT_BUCKET to the same value in .env.
--
-- Storage layout:  <bucket>/products/<seller-uid>/<product-uuid>/<timestamp>-<random>.<jpg|png|webp>
-- (see product-images-storage-policies.sql for who may do what)


-- ---------------------------------------------------------------------------
-- 1. products.images — all image URLs for a product, in display order.
--    images[1] (the first element) is the PRIMARY image.
--
--    The existing products.image column is kept and stays in sync with
--    images[1] (see the trigger in step 3), so every existing query, order
--    snapshot and older client keeps working unchanged.
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists images text[] not null default '{}';

-- Backfill: every existing product with a single image URL gets images = {image}.
-- Only real http(s) links are copied; a legacy value that is not a normal URL
-- (for example an old inline data: image) is left in `image` untouched, and the
-- app still displays it through its fallback to the legacy column.
update public.products
   set images = array[image]
 where cardinality(images) = 0
   and coalesce(image, '') ~* '^https?://';


-- ---------------------------------------------------------------------------
-- 2. Guard rails on the array: at most 10 images, and every entry must be a
--    plain http(s) URL (so image files / base64 can never be stored in the
--    database — only links to them).
-- ---------------------------------------------------------------------------

create or replace function public.product_images_are_urls(urls text[])
returns boolean
language sql
immutable
as $$
  select coalesce(bool_and(u ~* '^https?://' and length(u) <= 2048), true)
  from unnest(urls) as u;
$$;

alter table public.products drop constraint if exists products_images_max_10;
alter table public.products
  add constraint products_images_max_10 check (cardinality(images) <= 10);

alter table public.products drop constraint if exists products_images_are_urls;
alter table public.products
  add constraint products_images_are_urls check (public.product_images_are_urls(images));


-- ---------------------------------------------------------------------------
-- 3. Keep `image` (primary, single) and `images` (all) consistent.
--    * images has entries  -> image := images[1]
--    * images empty but image is a URL (an older client that only knows the
--      single `image` field) -> images := {image}
-- ---------------------------------------------------------------------------

create or replace function public.products_sync_primary_image()
returns trigger
language plpgsql
as $$
begin
  if new.images is null then
    new.images := '{}';
  end if;

  if cardinality(new.images) > 0 then
    new.image := new.images[1];
  elsif coalesce(new.image, '') ~* '^https?://' then
    new.images := array[new.image];
  end if;

  return new;
end;
$$;

drop trigger if exists products_sync_primary_image on public.products;
create trigger products_sync_primary_image
  before insert or update on public.products
  for each row execute procedure public.products_sync_primary_image();


-- ---------------------------------------------------------------------------
-- 4. Storage bucket.
--    * public read  -> product pages load images by plain URL, no auth needed
--    * 5 MB per file, JPG / PNG / WEBP only (enforced by Storage itself, in
--      addition to the checks the app does in the browser)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- 5. Access rules for objects in the bucket now live in their own file:
--
--        supabase/product-images-storage-policies.sql   (run it AFTER this one)
--
--    They were moved out because the earlier version of this section contained a
--    bug (a regex with a doubled backslash) that made Storage refuse EVERY upload
--    with "new row violates row-level security policy". Keeping a single copy of
--    the policies avoids re-running a stale one by accident.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- Optional checks (run manually, not part of the setup):
--
--   -- every product should now have its images populated:
--   select id, image, images from public.products limit 20;
--
--   -- folders in the bucket whose product no longer exists (leftovers from a
--   -- form that was closed before publishing). Remove them from the Storage
--   -- dashboard or with the Storage API — deleting rows from storage.objects
--   -- in SQL would NOT delete the files themselves.
--   select distinct split_part(name, '/', 2) as product_id
--   from storage.objects
--   where bucket_id = 'product-images'
--     and not exists (
--       select 1 from public.products p
--       where p.id::text = split_part(name, '/', 2)
--     );
-- ---------------------------------------------------------------------------
