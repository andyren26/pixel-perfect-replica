revoke execute on function public.create_booking(uuid, uuid) from public, anon;
grant execute on function public.create_booking(uuid, uuid) to authenticated;
revoke execute on function public.free_slots_on_cancel() from public, anon, authenticated;
