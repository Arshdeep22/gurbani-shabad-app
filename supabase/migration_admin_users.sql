-- ============================================================
-- Migration: admin-managed users + forced password change
-- Run this in Supabase SQL Editor after previous migrations.
-- ============================================================

-- 1. Add must_change_password flag to profiles
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- 2. Update the signup trigger so that when an admin creates a user
--    with metadata.must_change_password = true, the profile row is
--    initialised accordingly. Existing behaviour is preserved.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, username, full_name, role, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    ),
    'user',
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Allow the user to update their own must_change_password flag
--    (already covered by profiles_update_own_or_admin policy).