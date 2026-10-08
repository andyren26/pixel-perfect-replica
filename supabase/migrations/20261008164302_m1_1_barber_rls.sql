alter table public.platform_settings enable row level security;
alter table public.barbers           enable row level security;
alter table public.services          enable row level security;
alter table public.bookable_slots    enable row level security;
alter table public.barber_photos     enable row level security;

-- public.is_admin() and the profiles_select_admin policy already exist
-- (20261008152651_create_profiles), so they are not recreated here.

-- platform_settings: world-readable config, admin-only write.
create policy "platform_settings_read"  on public.platform_settings for select using (true);
create policy "platform_settings_admin" on public.platform_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- barbers: public read (no bank columns here); only the owning shop writes.
create policy "shops_select_public" on public.barbers for select using (true);
create policy "shops_insert_own" on public.barbers
  for insert with check ((select auth.uid()) = shop_id);
create policy "shops_update_own" on public.barbers
  for update using ((select auth.uid()) = shop_id) with check ((select auth.uid()) = shop_id);
create policy "shops_delete_own" on public.barbers
  for delete using ((select auth.uid()) = shop_id);

-- services: anyone may read; writes only under a barber the caller owns.
create policy "services_select_public" on public.services for select using (true);
create policy "services_write_own" on public.services
  for all using (
    exists (select 1 from public.barbers s where s.id = services.barber_id and s.shop_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.barbers s where s.id = services.barber_id and s.shop_id = (select auth.uid()))
  );

-- bookable_slots: same ownership rule; anyone may read.
create policy "slots_select_public" on public.bookable_slots for select using (true);
create policy "slots_write_own" on public.bookable_slots
  for all using (
    exists (select 1 from public.barbers s where s.id = bookable_slots.barber_id and s.shop_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.barbers s where s.id = bookable_slots.barber_id and s.shop_id = (select auth.uid()))
  );

-- barber_photos: public portfolio read; only the owning shop writes.
create policy "photos_select_public" on public.barber_photos for select using (true);
create policy "photos_write_own" on public.barber_photos
  for all using (
    exists (select 1 from public.barbers s where s.id = barber_photos.barber_id and s.shop_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.barbers s where s.id = barber_photos.barber_id and s.shop_id = (select auth.uid()))
  );

-- public browse projection of barbers; security_invoker so it respects barbers' RLS.
create or replace view public.barbers_public with (security_invoker = on) as
  select id, shop_id, name, intro, address, created_at
  from public.barbers;
