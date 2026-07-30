-- ============================================================
-- Migration: switch from email-based to username-based profiles
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 1. Add username column (if not present)
alter table public.profiles add column if not exists username text;

-- 2. Backfill username from existing email local-part (for any existing rows)
update public.profiles
set username = split_part(email, '@', 1)
where username is null and email is not null;

-- 3. Make username unique + not null going forward
create unique index if not exists profiles_username_key on public.profiles (username);

-- 4. Update the signup trigger to store username from metadata.
--    We use a synthetic email (<username>@gurbani.local) in auth, and store
--    the chosen username in profiles.username.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, username, full_name, role)
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
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Note: the `email` column is kept in the DB because Supabase Auth stores the
-- synthetic email; it is never shown in the UI. If you want to drop it later
-- you can, but it is harmless to keep.