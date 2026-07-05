-- Réinitialise le salon général (lobby_messages) chaque jour à minuit UTC,
-- pour libérer du stockage. À exécuter dans : Supabase -> SQL Editor -> Run.
--
-- Nécessite l'extension pg_cron. Si "create extension" échoue (plan ne le
-- permettant pas), active-la d'abord via Database -> Extensions -> rechercher
-- "pg_cron" -> Enable, puis relance ce script.

-- Autorise la suppression des messages de plus de 24h (nécessaire au filet de
-- sécurité côté client, en complément de la tâche planifiée ci-dessous).
drop policy if exists "lobby_messages_delete_old" on public.lobby_messages;
create policy "lobby_messages_delete_old" on public.lobby_messages
  for delete to authenticated using (created_at < now() - interval '24 hours');

create extension if not exists pg_cron with schema extensions;

-- Relance sûre : supprime la tâche existante du même nom si elle existe déjà
do $$
begin
  perform cron.unschedule('lobby-daily-reset');
exception when others then
  null;
end $$;

select cron.schedule(
  'lobby-daily-reset',
  '0 0 * * *',              -- tous les jours à 00:00 UTC
  $$ truncate table public.lobby_messages; $$
);
