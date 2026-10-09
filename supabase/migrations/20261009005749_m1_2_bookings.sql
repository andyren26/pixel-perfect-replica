create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.profiles(id) on delete cascade,
  service_id    uuid not null references public.services(id) on delete restrict,
  status        text not null default 'pending_payment'
                  check (status in ('pending_payment','paid','cancelled')),
  price         integer not null,
  paid_at       timestamptz,
  payout_id     uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();
create index if not exists idx_bookings_customer on public.bookings(customer_id);
create index if not exists idx_bookings_status   on public.bookings(status);
create index if not exists idx_bookings_service  on public.bookings(service_id);

create table if not exists public.booking_slots (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  slot_id    uuid not null references public.bookable_slots(id) on delete restrict,
  primary key (booking_id, slot_id)
);
create unique index if not exists uniq_slot_held on public.booking_slots(slot_id);
create index if not exists idx_booking_slots_booking on public.booking_slots(booking_id);

create view public.bookings_with_start
  with (security_invoker = true) as
select b.*,
       (select min(s.starts_at) from public.booking_slots bs
          join public.bookable_slots s on s.id = bs.slot_id
        where bs.booking_id = b.id) as starts_at,
       (select max(s.ends_at)  from public.booking_slots bs
          join public.bookable_slots s on s.id = bs.slot_id
        where bs.booking_id = b.id) as ends_at
from public.bookings b;

alter table public.bookings      enable row level security;
alter table public.booking_slots enable row level security;

create policy "bookings_select_own" on public.bookings
  for select using ((select auth.uid()) = customer_id);
create policy "bookings_insert_own" on public.bookings
  for insert with check ((select auth.uid()) = customer_id);
create policy "bookings_update_own" on public.bookings
  for update using ((select auth.uid()) = customer_id);
create policy "bookings_select_shop_owner" on public.bookings
  for select using (
    exists (
      select 1
      from public.services sv
      join public.barbers b on b.id = sv.barber_id
      where sv.id = bookings.service_id and b.shop_id = (select auth.uid())
    )
  );

create policy "booking_slots_select_public" on public.booking_slots
  for select using (true);
create policy "booking_slots_write_own" on public.booking_slots
  for all using (
    exists (select 1 from public.bookings b where b.id = booking_slots.booking_id and b.customer_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.bookings b where b.id = booking_slots.booking_id and b.customer_id = (select auth.uid()))
  );

create or replace function public.create_booking(p_service_id uuid, p_start_slot_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_barber_id uuid; v_n int; v_price int; v_start timestamptz;
  v_slot_ids uuid[]; v_booking_id uuid;
  v_slots record; v_prev_end timestamptz; v_count int := 0;
begin
  if auth.uid() is null then raise exception 'please sign in to book'; end if;
  select s.price, s.required_slots, sl.barber_id, sl.starts_at
    into v_price, v_n, v_barber_id, v_start
    from public.services s
    join public.bookable_slots sl on sl.id = p_start_slot_id
    where s.id = p_service_id;
  if v_barber_id is null then raise exception 'service or start slot not found'; end if;
  if not exists (select 1 from public.services s where s.id = p_service_id and s.barber_id = v_barber_id) then
    raise exception 'service and slot belong to different barbers';
  end if;

  v_slot_ids := array[]::uuid[];
  for v_slots in
    select id, starts_at, ends_at from public.bookable_slots
    where barber_id = v_barber_id and starts_at >= v_start
    order by starts_at
    limit v_n
  loop
    if v_count > 0 and v_slots.starts_at <> v_prev_end then
      raise exception 'this service needs % back-to-back slots from that start time, but the barber has a gap', v_n;
    end if;
    v_slot_ids := v_slot_ids || v_slots.id;
    v_prev_end := v_slots.ends_at;
    v_count := v_count + 1;
  end loop;
  if v_count <> v_n then
    raise exception 'not enough consecutive slots from that start time for this service (needs %)', v_n;
  end if;

  insert into public.bookings(customer_id, service_id, price)
    values (auth.uid(), p_service_id, v_price)
    returning id into v_booking_id;
  insert into public.booking_slots(booking_id, slot_id)
    select v_booking_id, unnest(v_slot_ids);

  return v_booking_id;
exception when unique_violation then
  raise exception 'one or more of those time slots were just taken — pick another start time';
end; $$;

create or replace function public.free_slots_on_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    delete from public.booking_slots where booking_id = new.id;
  end if;
  return new;
end; $$;
create trigger trg_free_slots_on_cancel
  after update of status on public.bookings
  for each row execute function public.free_slots_on_cancel();
