-- Cole no Supabase → SQL Editor → New Query → Run
-- Cache permanente de escudos: cada time é buscado UMA vez; depois disso o
-- app só lê esta tabela (e a nossa cópia no storage), sem chamar a API.
create table if not exists team_logos (
  cache_key text primary key,        -- "id:<id do time>" ou "name:<nome normalizado>"
  logo_url text,                     -- link da nossa cópia no storage; null = não achou
  team_id int,
  updated_at timestamptz default now()
);

-- Só o servidor (service_role) lê e grava; o navegador pergunta pela API do app.
alter table team_logos enable row level security;
