-- =============================================================
-- Revolver Noir — schéma Supabase
-- À exécuter dans : Supabase Dashboard -> SQL Editor -> New query
-- =============================================================

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  host_pseudo text not null default 'Joueur 1',
  guest_id uuid references auth.users (id) on delete set null,
  guest_pseudo text,
  state jsonb not null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  messages jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists games_code_idx on public.games (code);
create index if not exists games_status_idx on public.games (status);

-- Horodatage automatique
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists games_touch on public.games;
create trigger games_touch before update on public.games
for each row execute function public.touch_updated_at();

-- ------------------ Row Level Security ------------------
alter table public.games enable row level security;

-- Lecture : tout utilisateur connecté (nécessaire pour rejoindre par code)
drop policy if exists "games_select" on public.games;
create policy "games_select" on public.games
  for select to authenticated using (true);

-- Création : l'hôte crée sa propre partie
drop policy if exists "games_insert" on public.games;
create policy "games_insert" on public.games
  for insert to authenticated
  with check (auth.uid() = host_id);

-- Mise à jour : les participants, ou n'importe qui pour rejoindre une partie en attente
drop policy if exists "games_update" on public.games;
create policy "games_update" on public.games
  for update to authenticated
  using (
    auth.uid() = host_id
    or auth.uid() = guest_id
    or (status = 'waiting' and guest_id is null)
  );

-- Suppression : l'hôte uniquement
drop policy if exists "games_delete" on public.games;
create policy "games_delete" on public.games
  for delete to authenticated
  using (auth.uid() = host_id);

-- ------------------ Realtime ------------------
-- Active la diffusion des changements de la table games
alter publication supabase_realtime add table public.games;

-- Diffuser aussi les événements DELETE en temps réel (détection de départ)
alter table public.games replica identity full;
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
-- Salon de discussion général (accueil).
-- À exécuter dans : Supabase -> SQL Editor -> New query -> Run

create table if not exists public.lobby_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pseudo text not null,
  text text not null check (char_length(text) between 1 and 300),
  created_at timestamptz not null default now()
);

create index if not exists lobby_messages_created_idx on public.lobby_messages (created_at);

alter table public.lobby_messages enable row level security;

drop policy if exists "lobby_messages_select" on public.lobby_messages;
create policy "lobby_messages_select" on public.lobby_messages
  for select to authenticated using (true);

drop policy if exists "lobby_messages_insert" on public.lobby_messages;
create policy "lobby_messages_insert" on public.lobby_messages
  for insert to authenticated with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.lobby_messages;
