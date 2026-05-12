-- VibeCheck Supabase schema for the debugging training app.
-- Assumes PostgreSQL with the pgcrypto extension available for gen_random_uuid().

create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  post_id uuid primary key references public.posts(id) on delete cascade,
  like_count integer not null default 0,
  constraint likes_like_count_is_integer check (like_count = floor(like_count))
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_content_trgm_fallback_idx on public.posts (content);
create index if not exists likes_post_id_idx on public.likes (post_id);
create index if not exists users_display_name_idx on public.users (display_name);

alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.users enable row level security;

-- Training-friendly policies. These allow the demo frontend/backend to exercise all flows.
-- Tighten these before using the schema outside a controlled debugging lab.
create policy "Allow public read posts"
  on public.posts
  for select
  using (true);

create policy "Allow public insert posts"
  on public.posts
  for insert
  with check (true);

create policy "Allow public delete posts"
  on public.posts
  for delete
  using (true);

create policy "Allow public read likes"
  on public.likes
  for select
  using (true);

create policy "Allow public insert likes"
  on public.likes
  for insert
  with check (true);

create policy "Allow public update likes"
  on public.likes
  for update
  using (true)
  with check (true);

create policy "Allow public read users"
  on public.users
  for select
  using (true);

create policy "Allow public insert users"
  on public.users
  for insert
  with check (true);

create policy "Allow public update users"
  on public.users
  for update
  using (true)
  with check (true);

insert into public.posts (id, content, created_at)
values
  ('11111111-1111-4111-8111-111111111111', 'Primul vibe pentru debugging.', now() - interval '2 hours'),
  ('22222222-2222-4222-8222-222222222222', 'UI premium, UX suspect.', now() - interval '1 hour')
on conflict (id) do nothing;

insert into public.likes (post_id, like_count)
values
  ('11111111-1111-4111-8111-111111111111', 4),
  ('22222222-2222-4222-8222-222222222222', 7)
on conflict (post_id) do nothing;

insert into public.users (id, display_name, created_at, updated_at)
values
  ('33333333-3333-4333-8333-333333333333', 'Ada Debugger', now() - interval '3 hours', now() - interval '3 hours'),
  ('44444444-4444-4444-8444-444444444444', 'Mihai Stacktrace', now() - interval '2 hours', now() - interval '2 hours')
on conflict (id) do nothing;
