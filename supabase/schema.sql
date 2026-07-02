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
