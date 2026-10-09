-- Schema do banco de produção (Supabase, schema "public"), exportado em 09/10/2026.
-- Dá pra recriar o ambiente do zero rodando este arquivo no SQL Editor de um projeto novo.
-- Também precisa criar, em Storage, dois buckets PÚBLICOS: "avatars" e "team-logos".
-- Todas as tabelas têm RLS ligado. As tabelas de cache de jogos/estádios/escudos
-- não têm política de propósito: só o servidor (chave service_role) lê e grava nelas.

-- ---------- Respostas do Montar Roteiro e pedidos ----------
create table if not exists public.trip_answers (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  countries text[],
  date_start date,
  date_end date,
  flex_level text,
  adults integer default 2,
  kids integer default 0,
  budget text,
  priority text,
  pace text,
  created_at timestamptz default now(),
  favorite_teams text[] default '{}'::text[],
  plan jsonb,
  plan_generated_at timestamptz,
  selected_option text,
  selected_option_at timestamptz,
  constraint trip_answers_pkey primary key (id),
  constraint trip_answers_user_id_fkey foreign key (user_id) references auth.users(id),
  constraint trip_answers_selected_option_check check (selected_option is null or selected_option = any (array['A','B','C']))
);
alter table public.trip_answers enable row level security;

create table if not exists public.orders (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  trip_answers_id uuid,
  mercadopago_preference_id text,
  mercadopago_payment_id text,
  status text default 'pending',
  amount_cents integer default 4990,
  created_at timestamptz default now(),
  paid_at timestamptz,
  item_type text default 'consultoria',          -- hoje só existe 'consultoria'
  scheduled_date date,                           -- data escolhida para a sessão
  scheduled_time text,                           -- horário escolhido (ex.: "14:00")
  constraint orders_pkey primary key (id),
  constraint orders_trip_answers_id_fkey foreign key (trip_answers_id) references public.trip_answers(id) on delete set null,
  constraint orders_user_id_fkey foreign key (user_id) references auth.users(id)
);
alter table public.orders enable row level security;

-- ---------- Assinatura do Passport ----------
create table if not exists public.subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  plan text not null,
  status text not null default 'pending',
  mercadopago_preapproval_id text,
  current_period_end date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  payment_method_id text,
  constraint subscriptions_pkey primary key (id),
  constraint subscriptions_mercadopago_preapproval_id_key unique (mercadopago_preapproval_id),
  constraint subscriptions_user_id_fkey foreign key (user_id) references auth.users(id)
);
alter table public.subscriptions enable row level security;

-- ---------- Football Passport ----------
create table if not exists public.attended_games (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  source text not null default 'manual',         -- 'manual' | 'api' | 'csv'
  api_fixture_id integer,
  home_team text not null,
  away_team text not null,
  match_date date not null,
  stadium text,
  city text,
  country text not null,
  competition text,
  created_at timestamptz default now(),
  home_logo text,
  away_logo text,
  home_score integer,
  away_score integer,
  constraint attended_games_pkey primary key (id),
  constraint attended_games_user_id_fkey foreign key (user_id) references auth.users(id)
);
alter table public.attended_games enable row level security;

create table if not exists public.saved_games (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  fixture_id bigint not null,
  kickoff timestamptz not null,
  league_name text,
  league_country text,
  home_team text not null,
  home_logo text,
  away_team text not null,
  away_logo text,
  venue_name text,
  venue_city text,
  created_at timestamptz not null default now(),
  constraint saved_games_pkey primary key (id),
  constraint saved_games_user_id_fixture_id_key unique (user_id, fixture_id),
  constraint saved_games_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);
alter table public.saved_games enable row level security;
create index if not exists saved_games_user_kickoff_idx on public.saved_games using btree (user_id, kickoff);

create table if not exists public.public_profiles (
  user_id uuid not null,
  slug text not null,
  created_at timestamptz default now(),
  constraint public_profiles_pkey primary key (user_id),
  constraint public_profiles_slug_key unique (slug),
  constraint public_profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);
alter table public.public_profiles enable row level security;

create table if not exists public.newsletter_subscribers (
  id uuid not null default gen_random_uuid(),
  email text not null,
  created_at timestamptz default now(),
  constraint newsletter_subscribers_pkey primary key (id),
  constraint newsletter_subscribers_email_key unique (email)
);
alter table public.newsletter_subscribers enable row level security;

-- ---------- Caches de jogos, estádios e escudos (só o servidor usa) ----------
create table if not exists public.fixtures_cache (            -- Buscar Jogos: jogos por data
  fixture_id bigint not null,
  match_date date not null,
  kickoff timestamptz not null,
  league_id integer not null,
  league_name text not null,
  league_country text,
  home_team text,
  home_logo text,
  away_team text,
  away_logo text,
  venue_name text,
  venue_city text,
  lat double precision,
  lon double precision,
  geo_precision text not null default 'none',
  status text,
  fetched_at timestamptz not null default now(),
  constraint fixtures_cache_pkey primary key (fixture_id)
);
alter table public.fixtures_cache enable row level security;
create index if not exists fixtures_cache_match_date_idx on public.fixtures_cache using btree (match_date);

create table if not exists public.fixtures_fetch_log (
  match_date date not null,
  fetched_at timestamptz not null,
  total integer not null default 0,
  kept integer not null default 0,
  constraint fixtures_fetch_log_pkey primary key (match_date)
);
alter table public.fixtures_fetch_log enable row level security;

create table if not exists public.fixtures_calendar (         -- Montar Roteiro: calendário por liga
  fixture_id bigint not null,
  kickoff timestamptz not null,
  match_date date not null,
  league_id integer not null,
  league_name text not null,
  league_country text,
  league_season integer,
  league_round text,
  competition_type text not null,
  home_team_id bigint,
  home_team text,
  home_logo text,
  away_team_id bigint,
  away_team text,
  away_logo text,
  venue_name text,
  venue_city text,
  venue_capacity integer,
  venue_cc text,
  lat double precision,
  lon double precision,
  geo_precision text not null default 'none',
  status text,
  fetched_at timestamptz not null default now(),
  constraint fixtures_calendar_pkey primary key (fixture_id)
);
alter table public.fixtures_calendar enable row level security;
create index if not exists fixtures_calendar_date_idx on public.fixtures_calendar using btree (match_date);
create index if not exists fixtures_calendar_league_date_idx on public.fixtures_calendar using btree (league_id, match_date);

create table if not exists public.calendar_sync_log (
  league_id integer not null,
  season integer not null,
  fetched_at timestamptz not null,
  covers_until date not null,
  total integer not null default 0,
  kept integer not null default 0,
  teams_synced_at timestamptz,
  constraint calendar_sync_log_pkey primary key (league_id, season)
);
alter table public.calendar_sync_log enable row level security;

create table if not exists public.team_home_venues (
  team_id bigint not null,
  venue_name text,
  venue_city text,
  country text,
  fetched_at timestamptz not null default now(),
  venue_capacity integer,
  constraint team_home_venues_pkey primary key (team_id)
);
alter table public.team_home_venues enable row level security;

create table if not exists public.venues_cache (
  venue_id bigint not null,
  name text,
  city text,
  country text,
  fetched_at timestamptz not null default now(),
  capacity integer,
  constraint venues_cache_pkey primary key (venue_id)
);
alter table public.venues_cache enable row level security;

create table if not exists public.team_logos (                -- cache permanente de escudos
  cache_key text not null,                                    -- "id:<id do time>" ou "name:<nome normalizado>"
  logo_url text,
  team_id integer,
  updated_at timestamptz default now(),
  constraint team_logos_pkey primary key (cache_key)
);
alter table public.team_logos enable row level security;

-- ---------- Políticas (RLS) ----------
create policy "usuário vê só suas respostas" on public.trip_answers for select using (auth.uid() = user_id);
create policy "usuário cria suas respostas" on public.trip_answers for insert with check (auth.uid() = user_id);
create policy "usuário atualiza suas respostas" on public.trip_answers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "usuário exclui suas respostas" on public.trip_answers for delete using (auth.uid() = user_id);

create policy "usuário vê só seus pedidos" on public.orders for select using (auth.uid() = user_id);
create policy "usuário lê sua própria assinatura" on public.subscriptions for select using (auth.uid() = user_id);

create policy "usuário lê seus jogos assistidos" on public.attended_games for select using (auth.uid() = user_id);
create policy "usuário adiciona seus jogos assistidos" on public.attended_games for insert with check (auth.uid() = user_id);
create policy attended_games_update_own on public.attended_games for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "usuário exclui seus jogos assistidos" on public.attended_games for delete using (auth.uid() = user_id);

create policy "usuário lê seus jogos salvos" on public.saved_games for select using (auth.uid() = user_id);
create policy "usuário salva seus jogos" on public.saved_games for insert with check (auth.uid() = user_id);
create policy "usuário remove seus jogos salvos" on public.saved_games for delete using (auth.uid() = user_id);

create policy "Qualquer um pode consultar o slug público" on public.public_profiles for select using (true);
create policy "Usuário cria seu próprio slug" on public.public_profiles for insert with check (auth.uid() = user_id);

create policy "qualquer um pode se inscrever" on public.newsletter_subscribers for insert with check (true);
