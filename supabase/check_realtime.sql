-- Vérifie et (re)active la diffusion temps réel de la table games.
-- À exécuter dans Supabase → SQL Editor si les coups adverses n'apparaissent
-- pas instantanément (latence de quelques secondes = replié sur le polling).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;

alter table public.games replica identity full;

-- Vérification : doit renvoyer une ligne pour 'games'
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'games';
