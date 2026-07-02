-- À exécuter si votre table "games" existe déjà.
-- 1) Colonne de chat
alter table public.games
  add column if not exists messages jsonb not null default '[]'::jsonb;
-- 2) Diffusion des départs (événements DELETE) en temps réel
alter table public.games replica identity full;
