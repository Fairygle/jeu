-- Liste d'amis + présence en ligne.
-- À exécuter dans : Supabase -> SQL Editor -> New query -> Run

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null,
  last_seen timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated using (auth.uid() = id);

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friends enable row level security;

drop policy if exists "friends_select" on public.friends;
create policy "friends_select" on public.friends
  for select to authenticated using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "friends_insert" on public.friends;
create policy "friends_insert" on public.friends
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "friends_update" on public.friends;
create policy "friends_update" on public.friends
  for update to authenticated using (auth.uid() = friend_id);

drop policy if exists "friends_delete" on public.friends;
create policy "friends_delete" on public.friends
  for delete to authenticated using (auth.uid() = user_id or auth.uid() = friend_id);
