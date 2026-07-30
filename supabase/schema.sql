-- ============================================================
-- Gurbani Shabad App — Database Schema (run in Supabase SQL editor)
-- ============================================================

-- Profiles table (links to auth.users). Stores display name + role.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Shabads: each has ordering, title, gurmukhi + meaning lines, and a deadline (days).
create table if not exists public.shabads (
  id uuid primary key default gen_random_uuid(),
  order_index int not null default 0,
  title text not null,
  -- content stored as ordered array of {gurmukhi, meaning}
  lines jsonb not null default '[]'::jsonb,
  deadline_days int not null default 2,
  created_at timestamptz not null default now()
);

-- Reading progress: per user per shabad, track the 3 read checkboxes + timestamps.
create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  shabad_id uuid not null references public.shabads(id) on delete cascade,
  read_1 boolean not null default false,
  read_1_at timestamptz,
  read_2 boolean not null default false,
  read_2_at timestamptz,
  read_3 boolean not null default false,
  read_3_at timestamptz,
  started_at timestamptz not null default now(),
  understanding text,           -- the "test" input box content
  submitted_at timestamptz,     -- when understanding was submitted
  completed boolean not null default false,
  unique (user_id, shabad_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.shabads enable row level security;
alter table public.reading_progress enable row level security;

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Profiles policies
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- Shabads policies: shabad text is public reference material, so allow any
-- request (anon or authenticated) to read. Only admins can write.
drop policy if exists "shabads_select_all" on public.shabads;
create policy "shabads_select_all" on public.shabads
  for select using (true);

drop policy if exists "shabads_admin_write" on public.shabads;
create policy "shabads_admin_write" on public.shabads
  for all using (public.is_admin()) with check (public.is_admin());

-- Reading progress policies: user manages own; admin can read all.
drop policy if exists "progress_select_own_or_admin" on public.reading_progress;
create policy "progress_select_own_or_admin" on public.reading_progress
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "progress_insert_own" on public.reading_progress;
create policy "progress_insert_own" on public.reading_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "progress_update_own" on public.reading_progress;
create policy "progress_update_own" on public.reading_progress
  for update using (auth.uid() = user_id);

-- ============================================================
-- Auto-create a profile row when a new auth user signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- To make yourself an admin, run (replace email):
--   update public.profiles set role='admin' where email='you@example.com';
-- ============================================================