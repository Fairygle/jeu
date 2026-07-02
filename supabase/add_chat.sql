-- À exécuter si votre table "games" existe déjà (ajoute le chat sans tout recréer)
alter table public.games
  add column if not exists messages jsonb not null default '[]'::jsonb;
