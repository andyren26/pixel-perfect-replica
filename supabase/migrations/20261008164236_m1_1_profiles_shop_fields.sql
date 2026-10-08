-- Align profiles with the course M0 spec + M1.1 onboarding.
-- display_name = the SHOP NAME for shops (required to finish onboarding, shown on
-- the M2.2 payout page as payouts.shop_name); a customer's own name otherwise.
alter table public.profiles add column if not exists display_name text;

-- Users may edit their own display_name (plus the bank fields already granted).
-- role stays NOT client-writable: the only role change a user can make is the
-- customer -> shop upgrade below.
grant update (display_name) on public.profiles to authenticated;

-- "Become a shop": flips the CALLER's own role customer -> shop. Never writes admin
-- (admin is promoted only by a one-off migration in the M2.1 prereq).
create or replace function public.become_shop()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_role text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update public.profiles
     set role = 'shop'
   where id = auth.uid() and role = 'customer';
  select role into new_role from public.profiles where id = auth.uid();
  return new_role;
end;
$$;

revoke execute on function public.become_shop() from public, anon;
grant execute on function public.become_shop() to authenticated;
