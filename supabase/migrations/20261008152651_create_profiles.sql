-- profiles: one row per auth user, carrying the role.
-- The bank_account_* columns are the SHOP-LEVEL payout target: one shop can
-- run many barbers (M1.1), so the bank account belongs to the PERSON, not a
-- barber profile. They stay NULL until the shop fills "payout settings" in
-- M1.1; only the shop + an admin may read them. ("use test data first" —
-- manual month-end transfer, M2.2.)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'customer'
    check (role in ('customer', 'shop', 'admin')),
  bank_account_name text,
  bank_account_bank_code text,
  bank_account_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Admin check used by policies. SECURITY DEFINER so it can read profiles
-- without re-entering RLS (avoids policy recursion).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Read: each user sees only their own row (incl. their own bank_account_*);
-- admins see every row. Nobody else can read anyone's bank details.
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_select_admin" on public.profiles
  for select to authenticated
  using ((select public.is_admin()));

-- Update: users may edit their own row, but only the payout columns —
-- role/email/id are not client-writable (column grants below), so nobody
-- can promote themselves to shop/admin from the browser.
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (bank_account_name, bank_account_bank_code, bank_account_number)
  on public.profiles to authenticated;

-- Keep updated_at current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- New sign-up -> profiles row, role taken from sign-up metadata
-- (the Customer/Barber tab sends data.role = 'customer' | 'shop').
-- Metadata is client-controlled, so only 'customer'/'shop' are accepted;
-- anything else (incl. 'admin') falls back to 'customer'. Admins are set by hand.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when new.raw_user_meta_data->>'role' in ('customer', 'shop')
         then new.raw_user_meta_data->>'role'
         else 'customer' end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- BACKFILL: the trigger only fires on FUTURE signups, so any users who already
-- signed up during M0 testing (Steps 2 / 8.4) have NO profiles row. Create one
-- for each, reading the role from their existing sign-up metadata.
-- NOTE the fallback here is 'shop', NOT 'customer' (the trigger's default):
-- a user old enough to predate the trigger is almost certainly YOUR own early
-- barber/shop test account created before the role tab was wired, so 'shop' is
-- the safer guess for a metadata-less row. Fix any wrong guess with a one-off
-- UPDATE migration. on conflict do nothing -> safe to re-run; never clobbers a
-- row the trigger already made.
insert into public.profiles (id, email, role)
select
  u.id,
  u.email,
  case when u.raw_user_meta_data->>'role' in ('customer', 'shop')
       then u.raw_user_meta_data->>'role'
       else 'shop' end
from auth.users u
on conflict (id) do nothing;
