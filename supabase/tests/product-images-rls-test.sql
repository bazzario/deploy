-- Bazaario — Storage RLS isolation test for the product-images bucket.
--
-- Run in the Supabase SQL editor AFTER product-images-storage-policies.sql.
-- Needs at least two rows in auth.users (it uses the two oldest as "Seller A" and
-- "Seller B"). Everything happens inside one transaction that is ROLLED BACK at the
-- end, so no products, objects or users are left behind. Read the result in the
-- "Messages"/notices output: every line must start with PASS.
--
-- It impersonates each user exactly like Storage does (JWT claims + the
-- `authenticated` / `anon` database role) so the real RLS policies are evaluated.
--
-- Not covered here: DELETE. Recent Supabase versions block direct DELETE on
-- storage.objects from SQL ("use the Storage API"), which would hide the policy result.
-- DELETE uses the same USING expression as SELECT, and this test proves that
-- Seller A can neither SEE nor "manage" Seller B's object. For an end-to-end DELETE
-- check use the curl steps in PRODUCT_IMAGES_SETUP.md.

begin;

do $$
declare
  a uuid;
  b uuid;
  pid_a uuid := gen_random_uuid();
  pid_b uuid := gen_random_uuid();
  pid_new uuid := gen_random_uuid();
  seed_b text;
  ok boolean;
  n integer;
begin
  select id into a from auth.users order by created_at, id limit 1;
  select id into b from auth.users order by created_at, id offset 1 limit 1;
  if a is null or b is null then
    raise exception 'Need at least two users in auth.users to run this test.';
  end if;

  -- Fixtures, created as the (superuser) SQL-editor role.
  insert into public.products (id, title, owner_id) values (pid_a, 'rls-test A', a), (pid_b, 'rls-test B', b);
  seed_b := 'products/' || b || '/' || pid_b || '/seed-b.jpg';
  insert into storage.objects (bucket_id, name, owner_id) values ('product-images', seed_b, b::text);

  -- ------------------------------ Seller A ------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  begin  -- A uploads to own folder, own existing product
    insert into storage.objects (bucket_id, name, owner_id) values ('product-images', 'products/'||a||'/'||pid_a||'/a1.jpg', a::text);
    ok := true;
  exception when others then ok := false; end;
  raise notice '% A uploads to own folder / own product', case when ok then 'PASS' else 'FAIL' end;

  begin  -- A uploads a draft (product row not created yet)
    insert into storage.objects (bucket_id, name, owner_id) values ('product-images', 'products/'||a||'/'||pid_new||'/draft.png', a::text);
    ok := true;
  exception when others then ok := false; end;
  raise notice '% A uploads a draft product image', case when ok then 'PASS' else 'FAIL' end;

  begin  -- A tries to write into B's seller folder
    insert into storage.objects (bucket_id, name, owner_id) values ('product-images', 'products/'||b||'/'||gen_random_uuid()||'/evil.jpg', a::text);
    ok := true;
  exception when others then ok := false; end;
  raise notice '% A CANNOT upload into B''s seller folder', case when not ok then 'PASS' else 'FAIL' end;

  begin  -- A tries to add an image to B's product from A's own folder
    insert into storage.objects (bucket_id, name, owner_id) values ('product-images', 'products/'||a||'/'||pid_b||'/evil.jpg', a::text);
    ok := true;
  exception when others then ok := false; end;
  raise notice '% A CANNOT upload images for B''s product', case when not ok then 'PASS' else 'FAIL' end;

  begin  -- legacy path (no uid folder) is no longer accepted for uploads
    insert into storage.objects (bucket_id, name, owner_id) values ('product-images', 'products/'||pid_a||'/legacy.jpg', a::text);
    ok := true;
  exception when others then ok := false; end;
  raise notice '% legacy path upload is refused', case when not ok then 'PASS' else 'FAIL' end;

  begin  -- wrong extension
    insert into storage.objects (bucket_id, name, owner_id) values ('product-images', 'products/'||a||'/'||pid_a||'/x.gif', a::text);
    ok := true;
  exception when others then ok := false; end;
  raise notice '% non-image extension is refused', case when not ok then 'PASS' else 'FAIL' end;

  begin  -- wrong bucket must not be reachable through these policies
    insert into storage.objects (bucket_id, name, owner_id) values ('some-other-bucket', 'products/'||a||'/'||pid_a||'/x.jpg', a::text);
    ok := true;
  exception when others then ok := false; end;
  raise notice '% upload to another bucket is refused by these policies', case when not ok then 'PASS' else 'FAIL' end;

  select count(*) into n from storage.objects where bucket_id = 'product-images' and name = seed_b;
  raise notice '% A cannot see B''s object (rows visible: %)', case when n = 0 then 'PASS' else 'FAIL' end, n;

  raise notice '% A cannot "manage" (select/delete) B''s object', case when not public.can_manage_product_image(seed_b) then 'PASS' else 'FAIL' end;

  update storage.objects set name = name where bucket_id = 'product-images' and name = seed_b;
  get diagnostics n = row_count;
  raise notice '% A cannot modify B''s object (rows updated: %)', case when n = 0 then 'PASS' else 'FAIL' end, n;

  reset role;

  -- ------------------------------ Seller B ------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;

  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('product-images', 'products/'||b||'/'||pid_b||'/b2.webp', b::text);
    ok := true;
  exception when others then ok := false; end;
  raise notice '% B uploads to own folder / own product', case when ok then 'PASS' else 'FAIL' end;

  select count(*) into n from storage.objects where bucket_id = 'product-images' and name = seed_b;
  raise notice '% B can see own object', case when n = 1 then 'PASS' else 'FAIL' end;
  raise notice '% B can manage own object', case when public.can_manage_product_image(seed_b) then 'PASS' else 'FAIL' end;

  reset role;

  -- ------------------------------ Anonymous ------------------------------
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;

  begin
    insert into storage.objects (bucket_id, name) values ('product-images', 'products/'||a||'/'||pid_a||'/anon.jpg');
    ok := true;
  exception when others then ok := false; end;
  raise notice '% anonymous upload is refused', case when not ok then 'PASS' else 'FAIL' end;

  reset role;
end $$;

rollback;
