-- Bazaario — Storage access rules for the product-image bucket.
--
-- Run in the Supabase SQL editor AFTER supabase/product-images.sql (which creates
-- the bucket). Safe to re-run: functions use CREATE OR REPLACE, policies are dropped
-- and re-created by name, and NOTHING is deleted from storage.objects.
--
-- ROOT CAUSE THIS FIXES
--   The previous policy called public.product_image_path_ok(), whose regex was written
--   '...\\.(jpe?g|png|webp)$' inside a normal '...' string. With Postgres'
--   standard_conforming_strings = on (the Supabase default) that is TWO backslashes,
--   i.e. "a literal backslash followed by any character" — so no real file name such
--   as 1a2b-ff00.jpg could ever match, the INSERT policy always evaluated to false, and
--   Storage answered every upload with "new row violates row-level security policy"
--   (which the app showed as "You don't have permission to upload images").
--   Below, the dot is written as [.] so no backslash is involved at all.
--
-- BUCKET       product-images   (public read, 5 MB, JPG/PNG/WEBP — unchanged)
-- OBJECT PATH  products/<seller-uid>/<product-uuid>/<file>.(jpg|jpeg|png|webp)
--              (older files at products/<product-uuid>/<file> stay valid for
--               read/delete by their product's owner, but can no longer be UPLOADED)
--
-- WHO MAY DO WHAT (anonymous visitors only view images through the public URL):
--   INSERT  authenticated user, only into products/<their own auth.uid()>/<product-uuid>/,
--           and only if that product does not exist yet (draft) or belongs to them
--           (admins may upload for any product, still under their own uid folder).
--   SELECT  (used by the Storage "list" call)  the uploader (objects.owner_id = auth.uid()),
--           the owner of the product for legacy-path files, or an admin.
--   DELETE  same rule as SELECT.
--   UPDATE  nobody — files are never overwritten (the app sends x-upsert: false).

-- ---------------------------------------------------------------------------
-- 0. Report (does not change anything): other policies on storage.objects that
--    mention this bucket. If you see permissive ones you did not create (for
--    example "Allow all" / "public upload"), drop them by hand — this script
--    never drops policies it did not create.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select policyname, cmd, roles, coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname not in (
        'product-images: upload own', 'product-images: read own', 'product-images: delete own'
      )
      and (qual ilike '%product-images%' or with_check ilike '%product-images%'
           or (qual not ilike '%bucket_id%' and with_check not ilike '%bucket_id%'))
  loop
    raise notice 'REVIEW storage.objects policy "%" (%, roles %): using=[%] check=[%]',
      r.policyname, r.cmd, r.roles, r.qual, r.with_check;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Path shape checks. [.] instead of \. on purpose (see ROOT CAUSE).
-- ---------------------------------------------------------------------------

-- New layout: products/<uid>/<product-uuid>/<file>
create or replace function public.product_image_path_ok(object_name text)
returns boolean
language sql
immutable
as $$
  select object_name ~*
    '^products/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-][A-Za-z0-9._-]*[.](jpe?g|png|webp)$';
$$;

-- Legacy layout: products/<product-uuid>/<file>
create or replace function public.product_image_legacy_path_ok(object_name text)
returns boolean
language sql
immutable
as $$
  select object_name ~*
    '^products/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-][A-Za-z0-9._-]*[.](jpe?g|png|webp)$';
$$;

-- ---------------------------------------------------------------------------
-- 2. Authorisation helpers. SECURITY DEFINER so they can read products/profiles
--    whatever the caller's own RLS rights are; they only ever look at auth.uid().
-- ---------------------------------------------------------------------------

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin);
$$;

-- INSERT rule.
create or replace function public.can_upload_product_image(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pid uuid;
  product_owner uuid;
begin
  if uid is null or not public.product_image_path_ok(object_name) then
    return false;
  end if;

  -- The seller folder must be the caller's own id, taken from the verified JWT.
  if split_part(object_name, '/', 2) <> uid::text then
    return false;
  end if;

  pid := split_part(object_name, '/', 3)::uuid;
  select p.owner_id into product_owner from public.products p where p.id = pid;

  if not found then
    return true;  -- draft: the product row does not exist yet, the folder is the caller's own
  end if;

  return coalesce(product_owner = uid, false) or public.is_admin_user();
end;
$$;

-- SELECT / DELETE rule.
create or replace function public.can_manage_product_image(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  product_owner uuid;
begin
  if uid is null then
    return false;
  end if;

  if public.is_admin_user() then
    return public.product_image_path_ok(object_name) or public.product_image_legacy_path_ok(object_name);
  end if;

  -- New layout: only the seller whose uid is in the path.
  if public.product_image_path_ok(object_name) then
    return split_part(object_name, '/', 2) = uid::text;
  end if;

  -- Legacy layout: the owner of the product the folder is named after.
  if public.product_image_legacy_path_ok(object_name) then
    select p.owner_id into product_owner
    from public.products p
    where p.id = split_part(object_name, '/', 2)::uuid;
    return coalesce(product_owner = uid, false);
  end if;

  return false;
end;
$$;

revoke all on function public.can_upload_product_image(text) from public;
revoke all on function public.can_manage_product_image(text) from public;
revoke all on function public.is_admin_user() from public;
grant execute on function public.can_upload_product_image(text) to authenticated;
grant execute on function public.can_manage_product_image(text) to authenticated;
grant execute on function public.is_admin_user() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Policies (only the three this project created, re-created by name).
--    No policy for anon, none for UPDATE, none with WITH CHECK (true).
-- ---------------------------------------------------------------------------

drop policy if exists "product-images: upload own" on storage.objects;
drop policy if exists "product-images: read own"   on storage.objects;
drop policy if exists "product-images: delete own" on storage.objects;

create policy "product-images: upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and public.can_upload_product_image(name)
  );

create policy "product-images: read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'product-images'
    and (owner_id = auth.uid()::text or public.can_manage_product_image(name))
  );

create policy "product-images: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (owner_id = auth.uid()::text or public.can_manage_product_image(name))
  );

-- ---------------------------------------------------------------------------
-- 4. Quick self-check (pure functions, no data touched). All should print true.
-- ---------------------------------------------------------------------------
select
  public.product_image_path_ok('products/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/lk3j-ab12cd34.jpg') as new_path_ok,
  public.product_image_legacy_path_ok('products/22222222-2222-2222-2222-222222222222/lk3j-ab12cd34.png') as legacy_path_ok,
  not public.product_image_path_ok('products/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/x.gif') as bad_ext_rejected,
  not public.product_image_path_ok('products/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/../x.jpg') as traversal_rejected;
