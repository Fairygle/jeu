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
