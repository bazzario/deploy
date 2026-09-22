-- Bazaario — Part 3: realtime seller order notifications with per-seller read state.
--
-- Run this ONCE in your Supabase project's SQL editor, AFTER orders.sql (it needs
-- public.orders, the seller_ids trigger and the seller_orders view). Safe to re-run: every
-- statement is IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.
--
-- Scope: one new table (public.seller_order_notifications), its RLS, one trigger
-- function on public.orders, two RPCs, and adding the table to the Realtime
-- publication. It does not change public.orders, its policies or its triggers.
--
-- ---------------------------------------------------------------------------
-- HOW SELLER ISOLATION WORKS
--
-- Realtime "postgres_changes" sends the WHOLE changed row to every subscriber whose
-- RLS lets them SELECT it. If sellers listened to public.orders, a seller on a
-- multi-seller order would receive the other seller's items in the payload. So
-- sellers never listen to orders. Instead:
--
--   orders (INSERT) --trigger--> one row PER SELLER in seller_order_notifications
--
-- A notification row holds only that seller's own share (line count, quantity,
-- subtotal) and NO buyer name / phone / email / address / items. RLS on it is
-- "seller_id = auth.uid()", so Realtime delivers a row only to the seller it
-- belongs to, and the client's own `seller_id=eq.<me>` filter is just an
-- optimisation on top of that. The order itself is then fetched through
-- public.seller_orders (orders.sql), which returns only that seller's own lines.
--
-- READ STATE: `read_at` on each notification row. It is per seller AND per order,
-- so Seller A opening order #123 never changes Seller B's row. There is no
-- global is_read flag on orders.
-- ---------------------------------------------------------------------------

create table if not exists public.seller_order_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- NULL = unread. Set only by mark_seller_order_read() / mark_all_seller_orders_read().
  read_at timestamptz,
  -- This seller's share of the order only (never the whole order).
  line_count integer not null default 0,
  item_qty numeric not null default 0,
  subtotal numeric not null default 0,
  constraint seller_order_notifications_order_seller_key unique (order_id, seller_id)
);

create index if not exists seller_order_notifications_seller_idx
  on public.seller_order_notifications (seller_id, created_at desc);

create index if not exists seller_order_notifications_unread_idx
  on public.seller_order_notifications (seller_id, created_at desc)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- Access: a signed-in seller can READ their own rows and nothing else. There is
-- no insert/update/delete policy AND the table privileges are revoked, so the
-- REST API can never write here — only the trigger below and the two RPCs can.
-- ---------------------------------------------------------------------------

alter table public.seller_order_notifications enable row level security;

drop policy if exists "seller_order_notifications: read own" on public.seller_order_notifications;
create policy "seller_order_notifications: read own"
  on public.seller_order_notifications for select
  to authenticated
  using (seller_id = auth.uid());

revoke all on public.seller_order_notifications from public, anon, authenticated;
grant select on public.seller_order_notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: create/refresh one notification per seller of an order.
--
-- Runs AFTER the orders_guard_items trigger has stamped items[].sellerId from
-- public.products.owner_id and derived seller_ids, so it only ever sees
-- database-stamped seller ids — never anything the buyer typed.
--
-- A notification must never break checkout, so the body is wrapped: if anything
-- goes wrong the order is still saved and a WARNING is logged.
-- ---------------------------------------------------------------------------

create or replace function public.orders_notify_sellers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.seller_order_notifications (order_id, seller_id, line_count, item_qty, subtotal)
    select new.id,
           l.seller_id,
           count(*)::integer,
           coalesce(sum(l.qty), 0),
           coalesce(sum(l.price * l.qty), 0)
    from (
      select (e.elem ->> 'sellerId')::uuid as seller_id,
             case when e.elem ->> 'qty' ~ '^[0-9]{1,9}(\.[0-9]+)?$'
                  then (e.elem ->> 'qty')::numeric else 0 end as qty,
             case when e.elem ->> 'price' ~ '^[0-9]{1,12}(\.[0-9]+)?$'
                  then (e.elem ->> 'price')::numeric else 0 end as price
      from jsonb_array_elements(new.items) as e(elem)
      where e.elem ->> 'sellerId' is not null
    ) l
    group by l.seller_id
    on conflict (order_id, seller_id) do update
      set line_count = excluded.line_count,
          item_qty   = excluded.item_qty,
          subtotal   = excluded.subtotal
      where (public.seller_order_notifications.line_count,
             public.seller_order_notifications.item_qty,
             public.seller_order_notifications.subtotal)
            is distinct from (excluded.line_count, excluded.item_qty, excluded.subtotal);

    -- An admin/SQL-editor edit of items can drop a seller from the order; that
    -- seller must not keep a notification for an order they can no longer open.
    if tg_op = 'UPDATE' then
      delete from public.seller_order_notifications n
       where n.order_id = new.id
         and not (n.seller_id = any (new.seller_ids));
    end if;
  exception when others then
    raise warning 'seller_order_notifications: could not record notifications for order %: %',
      new.id, sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.orders_notify_sellers() from public, anon, authenticated;

drop trigger if exists orders_notify_sellers_ins on public.orders;
create trigger orders_notify_sellers_ins
  after insert on public.orders
  for each row execute function public.orders_notify_sellers();

-- Items can only change through an admin / the SQL editor (orders_guard_items
-- refuses buyers), and only then can seller_ids change.
drop trigger if exists orders_notify_sellers_upd on public.orders;
create trigger orders_notify_sellers_upd
  after update of items on public.orders
  for each row
  when (old.items is distinct from new.items)
  execute function public.orders_notify_sellers();

-- ---------------------------------------------------------------------------
-- Marking notifications read. Both functions act on auth.uid()'s rows only —
-- there is no seller-id argument — so a seller cannot mark anyone else's read.
-- ---------------------------------------------------------------------------

-- true = it was unread and is now read; false = nothing to change (already read,
-- or the order has no notification for this seller).
create or replace function public.mark_seller_order_read(p_order_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_changed integer;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  update public.seller_order_notifications
     set read_at = now()
   where order_id = p_order_id
     and seller_id = v_uid
     and read_at is null;

  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;

-- Returns how many notifications were marked read.
create or replace function public.mark_all_seller_orders_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_changed integer;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  update public.seller_order_notifications
     set read_at = now()
   where seller_id = v_uid
     and read_at is null;

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

-- Supabase grants EXECUTE on new functions to anon by default; revoke it explicitly.
revoke all on function public.mark_seller_order_read(text) from public, anon;
revoke all on function public.mark_all_seller_orders_read() from public, anon;
grant execute on function public.mark_seller_order_read(text) to authenticated;
grant execute on function public.mark_all_seller_orders_read() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: publish the notifications table (and ONLY it — orders is not added).
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publication supabase_realtime does not exist, so seller_order_notifications was NOT added to Realtime. Enable Realtime for this project (Dashboard -> Database -> Publications) and re-run this file.';
  elsif exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    raise notice 'supabase_realtime already publishes ALL tables, so seller_order_notifications is included.';
  elsif not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'seller_order_notifications'
  ) then
    alter publication supabase_realtime add table public.seller_order_notifications;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- OPTIONAL, run by hand only if you want it: give sellers' EXISTING orders (placed
-- before this file) a notification row that is already marked read. Without it
-- those older orders simply have no notification row, which the app treats as
-- "read", so this is not required.
--
--   insert into public.seller_order_notifications
--     (order_id, seller_id, created_at, read_at, line_count)
--   select o.id, s, o.created_at, o.created_at, 0
--   from public.orders o, unnest(o.seller_ids) as s
--   on conflict (order_id, seller_id) do nothing;
-- ---------------------------------------------------------------------------
