-- Onde assistir: canais de TV/streaming de cada jogo (Brasil), buscados pelo Gemini (busca do Google) e VALIDADOS antes de guardar.
-- Rode UMA vez no SQL Editor do Supabase. É seguro rodar de novo. As tabelas ficam com RLS ligado e SEM política: só o servidor lê e grava.

create table if not exists public.fixture_broadcasts (
  fixture_id bigint primary key,                   -- o mesmo número do jogo em fixtures_calendar
  channels jsonb not null,                         -- [{ "name": "Globo", "note": "SP e parte da rede" }, ...]
  source_hosts text[] not null default '{}',       -- de onde a informação saiu (ex.: {ge.globo.com})
  kickoff timestamptz,
  confirmed_at timestamptz not null default now(), -- quando foi confirmado (decide se está velho)
  source text not null default 'gemini'
);
create index if not exists fixture_broadcasts_kickoff_idx on public.fixture_broadcasts (kickoff);
alter table public.fixture_broadcasts enable row level security;

-- Registro de cada consulta ao Gemini: serve de trava (uma por vez), de limite por dia e de freio quando a chave falha.
create table if not exists public.broadcast_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'user' check (kind in ('user', 'test')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  asked integer not null default 0,
  accepted integer not null default 0,
  rejected integer not null default 0,
  error text,
  model text
);
create index if not exists broadcast_runs_started_idx on public.broadcast_runs (started_at desc);
alter table public.broadcast_runs enable row level security;
