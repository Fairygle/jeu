-- À exécuter sur votre base existante : colonne technique pour le chrono,
-- le forfait d'inactivité et la recherche automatique.
alter table public.games
  add column if not exists meta jsonb not null default '{}'::jsonb;
