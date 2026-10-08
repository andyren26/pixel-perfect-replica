-- Public bucket for barber portfolio photos (idempotent).
insert into storage.buckets (id, name, public)
values ('barber-photos', 'barber-photos', true)
on conflict (id) do update set public = true;

-- Public READ (anyone can view a barber's portfolio image).
create policy "barber_photos_read" on storage.objects
  for select using ( bucket_id = 'barber-photos' );

-- Only the owning shop may upload/update/remove, under '<barber_id>/...'.
create policy "barber_photos_write_own" on storage.objects
  for all using (
    bucket_id = 'barber-photos'
    and exists (
      select 1 from public.barbers s
      where s.shop_id = (select auth.uid())
        and s.id::text = split_part(storage.objects.name, '/', 1)
    )
  ) with check (
    bucket_id = 'barber-photos'
    and exists (
      select 1 from public.barbers s
      where s.shop_id = (select auth.uid())
        and s.id::text = split_part(storage.objects.name, '/', 1)
    )
  );
