-- tripsz.social — FASE 2: posts, check-in no estádio, curtidas e comentários.
-- Rode UMA vez no SQL Editor do Supabase (depois do supabase-social-fase1.sql). É seguro rodar de novo.
-- As tabelas ficam com RLS LIGADO e SEM política: só o servidor (service_role) lê e grava. As fotos dos posts usam o bucket
-- "social" da Fase 1 (cada pessoa grava só na própria pasta).

-- ---------- 1) posts (publicação sobre um estádio que a pessoa já foi) e check-ins (a pessoa ESTÁ no estádio) ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('post', 'checkin')),
  body text check (body is null or char_length(body) <= 500),
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  stadium_name text not null check (char_length(stadium_name) between 1 and 160),
  stadium_city text,
  stadium_country text,
  game_home text,
  game_away text,
  game_date date,
  game_competition text,
  game_fixture_id bigint,
  visibility text not null default 'public' check (visibility in ('public', 'friends', 'private')),  -- friends = quem me segue
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- um post precisa de texto ou foto; o check-in pode ir "seco"
  constraint posts_has_content check (kind = 'checkin' or char_length(btrim(coalesce(body, ''))) > 0 or cardinality(photos) > 0)
);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc) where deleted_at is null;
create index if not exists posts_created_idx on public.posts (created_at desc) where deleted_at is null;
create index if not exists posts_stadium_idx on public.posts (stadium_name, created_at desc) where deleted_at is null;
create index if not exists posts_checkin_idx on public.posts (kind, created_at desc) where deleted_at is null and kind = 'checkin';
alter table public.posts enable row level security;

-- ---------- 2) curtidas ----------
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id);
alter table public.post_likes enable row level security;

-- ---------- 3) comentários ----------
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at) where deleted_at is null;
create index if not exists post_comments_author_idx on public.post_comments (author_id, created_at desc);
alter table public.post_comments enable row level security;
