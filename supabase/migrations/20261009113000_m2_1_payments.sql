-- M2.1: Stripe pay-at-booking.
--
-- 1) commission_rates: the versioned platform ratio. "The rate for a booking" is the row with the
--    greatest effective_from <= the booking's paid_at. Change it by INSERTing a later row.
--    There is NO transactions table and NO fee columns on bookings: the split is computed at
--    payout-build time (M2.2) from the picked paid bookings x commission_rates.
create table if not exists public.commission_rates (
  id             uuid primary key default gen_random_uuid(),
  effective_from date not null unique,
  platform_pct   numeric(5,4) not null check (platform_pct >= 0 and platform_pct < 1),  -- 0.2000 = 20%
  note           text
);
insert into public.commission_rates (effective_from, platform_pct, note)
  values ('2026-01-01', 0.20, 'default 20% platform / 80% shop')
  on conflict (effective_from) do nothing;

alter table public.commission_rates enable row level security;
create policy "commission_rates_select_public" on public.commission_rates
  for select using (true);
create policy "commission_rates_write_admin" on public.commission_rates
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- 2) bookings.stripe_payment_intent_id: stamped by the webhook on the paid flip.
--    Reconciliation pointer back to Stripe + a hard idempotency backstop (UNIQUE).
alter table public.bookings add column if not exists stripe_payment_intent_id text;
create unique index if not exists uniq_bookings_pi on public.bookings(stripe_payment_intent_id);

-- 3) Guard browser writes to bookings. RLS lets a customer UPDATE their own row, which (with
--    payments live) would let them set status='paid' or change the price without paying.
--    From the browser (roles anon/authenticated) the ONLY allowed write is cancelling one's own
--    pending_payment booking. Bookings are created by the create_booking RPC (SECURITY DEFINER,
--    so it runs as the table owner and passes), and only the Stripe webhook (service_role)
--    marks a booking paid.
create or replace function public.guard_booking_client_writes()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;  -- create_booking (definer), the webhook (service_role), migrations
  end if;

  if tg_op = 'INSERT' then
    raise exception 'bookings must be created through create_booking()'
      using errcode = '42501';
  end if;

  if not (
        old.status = 'pending_payment'
    and new.status = 'cancelled'
    and new.id = old.id
    and new.customer_id = old.customer_id
    and new.service_id = old.service_id
    and new.price = old.price
    and new.paid_at is not distinct from old.paid_at
    and new.payout_id is not distinct from old.payout_id
    and new.stripe_payment_intent_id is not distinct from old.stripe_payment_intent_id
    and new.created_at = old.created_at
  ) then
    raise exception 'only cancelling an unpaid booking is allowed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger trg_guard_booking_client_writes
  before insert or update on public.bookings
  for each row execute function public.guard_booking_client_writes();
