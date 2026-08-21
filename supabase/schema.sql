-- Pixel Party: таблица комнат (связь комнаты с создателем)
-- Запустить один раз в Supabase: SQL Editor -> New query -> вставить -> Run

create table if not exists public.rooms (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  host_id text not null,
  status text not null default 'waiting',
  game_mode text not null default 'classic',
  width int not null default 64,
  height int not null default 64,
  mosaic_config jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rooms_owner_created_idx on public.rooms (owner_id, created_at desc);

alter table public.rooms enable row level security;

drop policy if exists "rooms_select_own" on public.rooms;
create policy "rooms_select_own" on public.rooms for select using (auth.uid() = owner_id);

drop policy if exists "rooms_insert_own" on public.rooms;
create policy "rooms_insert_own" on public.rooms for insert with check (auth.uid() = owner_id);

drop policy if exists "rooms_update_own" on public.rooms;
create policy "rooms_update_own" on public.rooms for update using (auth.uid() = owner_id);

drop policy if exists "rooms_delete_own" on public.rooms;
create policy "rooms_delete_own" on public.rooms for delete using (auth.uid() = owner_id);
