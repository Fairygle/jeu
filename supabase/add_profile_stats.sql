-- Stats de jeu + avatar sur les profils.
-- À exécuter dans : Supabase -> SQL Editor -> New query -> Run

alter table public.profiles
  add column if not exists avatar text,
  add column if not exists games_played integer not null default 0,
  add column if not exists games_won integer not null default 0,
  add column if not exists turns_sum integer not null default 0;
