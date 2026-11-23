-- Darts: per-user cloud save. Apply with `supabase db push` or paste into the SQL editor.

create table if not exists public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  settings    jsonb not null default '{}'::jsonb,
  lifetime    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.matches (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  mode       text not null check (mode in ('x01', 'cricket', 'atc')),
  played_at  timestamptz not null default now(),
  summary    jsonb not null
);
create index if not exists matches_user_played on public.matches (user_id, played_at desc);

-- Row level security: each user can only see and change their own rows.
alter table public.profiles enable row level security;
alter table public.matches enable row level security;

create policy "profiles: read own"   on public.profiles for select using (auth.uid() = user_id);
create policy "profiles: insert own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles: delete own" on public.profiles for delete using (auth.uid() = user_id);

create policy "matches: read own"   on public.matches for select using (auth.uid() = user_id);
create policy "matches: insert own" on public.matches for insert with check (auth.uid() = user_id);
create policy "matches: delete own" on public.matches for delete using (auth.uid() = user_id);
