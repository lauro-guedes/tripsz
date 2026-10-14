-- Cache permanente das fotos de estádio (Wikipedia). Rode UMA vez no SQL Editor do Supabase.
-- Sem esta tabela a busca da foto continua funcionando, só fica mais lenta na primeira vez de cada estádio.
create table if not exists public.venue_photos (
  cache_key text primary key,        -- "<nome normalizado>|<cidade normalizada>"
  url text,                          -- null = não achou foto confiável
  source text,
  page text,
  fetched_at timestamptz not null default now()
);
alter table public.venue_photos enable row level security;
