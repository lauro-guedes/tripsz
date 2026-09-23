-- Cole isto no painel do Supabase → SQL Editor → New Query → Run
-- Cria as tabelas que o app precisa além do login (que o Supabase já cuida sozinho).

create table if not exists trip_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  countries text[],
  date_start date,
  date_end date,
  flex_level text,
  adults int default 2,
  kids int default 0,
  budget text,
  priority text,
  pace text,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  trip_answers_id uuid references trip_answers,
  mercadopago_preference_id text,
  mercadopago_payment_id text,
  status text default 'pending', -- pending | paid | failed
  amount_cents int default 4990, -- R$ 49,90
  created_at timestamptz default now(),
  paid_at timestamptz
);

-- Segurança: cada pessoa só vê os próprios dados
alter table trip_answers enable row level security;
alter table orders enable row level security;

create policy "usuário vê só suas respostas"
  on trip_answers for select
  using (auth.uid() = user_id);

create policy "usuário cria suas respostas"
  on trip_answers for insert
  with check (auth.uid() = user_id);

create policy "usuário vê só seus pedidos"
  on orders for select
  using (auth.uid() = user_id);
