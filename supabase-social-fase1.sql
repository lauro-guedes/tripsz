-- tripsz.social — FASE 1: perfil social, seguir (= amigo), bloquear e denunciar.
-- Rode UMA vez no SQL Editor do Supabase. É seguro rodar de novo (tudo com "if not exists" / "drop policy if exists").
--
-- As tabelas novas ficam com RLS LIGADO e SEM política: só o servidor (chave service_role) lê e grava, como as de convite
-- e acompanhantes. O navegador nunca fala direto com elas.

-- ---------- 1) perfil social (colunas novas em public.profiles) ----------
alter table public.profiles add column if not exists display_name text;          -- nome público ("Lauro Guedes")
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists cover_url text;             -- foto de capa
alter table public.profiles add column if not exists avatar_url text;            -- foto de perfil (visível pra outras pessoas)
alter table public.profiles add column if not exists profile_kinds text[] not null default '{}'; -- Groundhopper, Torcedor, Viajante, Colecionador
alter table public.profiles add column if not exists is_private boolean not null default false;  -- perfil privado: seguir pede aprovação
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists social_onboarded_at timestamptz;            -- fez os 4 passos do perfil social
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_len') then
    alter table public.profiles add constraint profiles_bio_len check (bio is null or char_length(bio) <= 150);
  end if;
end $$;

-- Quem já tinha foto/país no cadastro (Google, "Meu Perfil") passa a tê-los no perfil social.
update public.profiles p set avatar_url = u.raw_user_meta_data->>'avatar_url'
  from auth.users u where u.id = p.user_id and p.avatar_url is null and coalesce(u.raw_user_meta_data->>'avatar_url', '') <> '';
update public.profiles p set country = u.raw_user_meta_data->>'country'
  from auth.users u where u.id = p.user_id and p.country is null and coalesce(u.raw_user_meta_data->>'country', '') <> '';

-- ---------- 2) seguir (seguir = ser amigo) ----------
-- 'accepted' = já segue; 'pending' = pediu pra seguir um perfil PRIVADO e espera a aprovação.
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'accepted' check (status in ('accepted', 'pending')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id, status, created_at desc);
create index if not exists follows_follower_idx on public.follows (follower_id, status, created_at desc);
alter table public.follows enable row level security;

-- ---------- 3) bloquear ----------
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);
alter table public.user_blocks enable row level security;

-- ---------- 4) denunciar (perfil, e depois posts e comentários) ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('profile', 'post', 'comment')),
  target_id text not null,                       -- username (perfil) ou id (post/comentário)
  reason text not null check (reason in ('spam', 'assedio', 'nudez', 'violencia', 'falso', 'outro')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index if not exists reports_once_per_reporter on public.reports (reporter_id, target_type, target_id);
create index if not exists reports_open_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;

-- ---------- 5) fotos de capa e de perfil (Storage) ----------
-- Bucket público para leitura (as fotos aparecem no perfil de qualquer pessoa); só o DONO grava na própria pasta (<id do usuário>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social', 'social', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "social: leitura publica" on storage.objects;
create policy "social: leitura publica" on storage.objects for select using (bucket_id = 'social');
drop policy if exists "social: dono envia" on storage.objects;
create policy "social: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'social' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "social: dono troca" on storage.objects;
create policy "social: dono troca" on storage.objects for update to authenticated
  using (bucket_id = 'social' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "social: dono apaga" on storage.objects;
create policy "social: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'social' and (storage.foldername(name))[1] = auth.uid()::text);
