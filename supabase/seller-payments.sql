-- Bazaario — seller plan renewal payments.
--
-- Run this ONCE in your Supabase SQL editor, AFTER seller-plan.sql.
-- Safe to re-run. Scope: one new table + one server-side function.
-- It does NOT touch products, used_items, automobiles, orders or auth.
--
-- Security model:
--   * The browser can only READ its own payment rows.
--   * The browser can NEVER insert or update a payment row, and can never
--     write seller_plan_status / seller_plan_paid_until.
--   * Rows are created and marked 'paid' only by the Edge Functions, which
--     use the service_role key server-side (never shipped to the browser).

create table if not exists public.seller_payments (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users (id) on delete cascade,
  plan text not null default 'seller_listing_renewal',
  amount numeric,
  currency text not null default 'PKR',
  payment_method text not null,
  -- Gateway ki apni reference (JazzCash txnRefNo / Easypaisa orderId /
  -- card gateway ka transaction id). Verification ke baad bharti hai.
  transaction_id text,
  status text not null default 'pending',
  -- Gateway ka raw callback payload (audit ke liye). Koi secret key yahan na rakhein.
  gateway_response jsonb,
  -- Is payment se plan kab tak barhaya gaya.
  paid_until timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.seller_payments drop constraint if exists seller_payments_status_check;
alter table public.seller_payments
  add constraint seller_payments_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled'));

alter table public.seller_payments drop constraint if exists seller_payments_method_check;
alter table public.seller_payments
  add constraint seller_payments_method_check
  check (payment_method in ('card', 'jazzcash', 'easypaisa'));

create index if not exists seller_payments_seller_idx
  on public.seller_payments (seller_id, created_at desc);

alter table public.seller_payments enable row level security;

-- Seller apni hi payments dekh sakta hai; admin sab dekh sakta hai.
drop policy if exists "seller_payments: read own or admin" on public.seller_payments;
create policy "seller_payments: read own or admin"
  on public.seller_payments for select
  using (
    auth.uid() = seller_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- Jaan boojh kar koi insert/update/delete policy NAHI di gayi. Iska matlab:
-- anon/authenticated key se koi payment row na ban sakti hai na badal sakti
-- hai. Sirf service_role (Edge Function) RLS bypass karke likh sakta hai.

-- Verified payment ko apply karne wala function. Ise SIRF Edge Function
-- (service_role) call karta hai, gateway ka signature verify karne ke BAAD.
-- Yeh function khud bhi service_role check karta hai, taake galti se bhi
-- browser se call na ho sake.
create or replace function public.apply_verified_seller_payment(
  p_payment_id uuid,
  p_transaction_id text,
  p_months integer default 12,
  p_gateway_response jsonb default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid;
  v_status text;
  v_current timestamptz;
  v_until timestamptz;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Only the server can apply a verified payment';
  end if;

  select seller_id, status into v_seller, v_status
  from public.seller_payments
  where id = p_payment_id
  for update;

  if v_seller is null then
    raise exception 'Payment not found';
  end if;

  -- Pehle se paid hai to dobara extend na karein (duplicate webhook safety).
  if v_status = 'paid' then
    select seller_plan_paid_until into v_until from public.profiles where id = v_seller;
    return v_until;
  end if;

  select seller_plan_paid_until into v_current from public.profiles where id = v_seller;

  -- Agar plan abhi bhi chal raha hai to usi ke aage jorein, warna aaj se.
  v_until := greatest(coalesce(v_current, now()), now()) + (p_months || ' months')::interval;

  update public.seller_payments
     set status = 'paid',
         transaction_id = coalesce(p_transaction_id, transaction_id),
         gateway_response = coalesce(p_gateway_response, gateway_response),
         paid_at = now(),
         paid_until = v_until
   where id = p_payment_id;

  update public.profiles
     set seller_plan_status = 'paid',
         seller_plan_paid_until = v_until
   where id = v_seller;

  return v_until;
end;
$$;

revoke all on function public.apply_verified_seller_payment(uuid, text, integer, jsonb) from public;
revoke all on function public.apply_verified_seller_payment(uuid, text, integer, jsonb) from anon;
revoke all on function public.apply_verified_seller_payment(uuid, text, integer, jsonb) from authenticated;
grant execute on function public.apply_verified_seller_payment(uuid, text, integer, jsonb) to service_role;

-- Agar kabhi manually (offline/bank transfer) renewal karni ho, to admin
-- Supabase SQL editor se seedha bhi kar sakta hai:
--   update public.profiles
--      set seller_plan_status = 'paid',
--          seller_plan_paid_until = now() + interval '12 months'
--    where id = '<user-uuid>';
