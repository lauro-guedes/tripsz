-- Cache dos detalhes de um jogo (escalação, gols, estatísticas) — modal "Detalhes da experiência".
-- Jogo encerrado nunca muda, então cada jogo é consultado na API-Football uma vez só.
-- Só o servidor (chave service_role) lê e grava: RLS ligado e SEM política, de propósito.
create table if not exists public.fixture_details_cache (
  fixture_id bigint primary key,
  payload jsonb not null,
  status text,
  fetched_at timestamptz not null default now()
);

alter table public.fixture_details_cache enable row level security;
