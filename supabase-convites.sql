-- Convites de jogo ("Quem foi com você?") — fase 1.
--
-- Só o SERVIDOR (chave service_role) lê e grava estas tabelas: RLS ligado e SEM política, de propósito
-- (como os outros caches do projeto). O navegador nunca fala direto com elas.
--
-- O código do convite (128 bits aleatórios) NUNCA é guardado: só o hash dele (token_hash). Quem tem o
-- link entra; ninguém, nem com acesso ao banco, consegue reconstruir um link a partir do que está aqui.
create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  -- Jogo de quem convidou. "on delete set null": se ele apagar o jogo depois, o convite continua valendo
  -- (a cópia abaixo é o que o convidado recebe).
  attended_game_id uuid references public.attended_games(id) on delete set null,
  token_hash text not null unique,
  -- Só o NOME que quem convidou digitou. Telefone e e-mail do convidado não são guardados.
  invitee_name text not null,
  channel text not null check (channel in ('whatsapp', 'email', 'link')),
  -- Cópia dos dados do jogo no momento do convite (times, placar, estádio, data...).
  game_snapshot jsonb not null,
  -- 'pending' | 'claimed' | 'revoked'. "Expirado" não é um status: é pending com expires_at no passado.
  status text not null default 'pending' check (status in ('pending', 'claimed', 'revoked')),
  expires_at timestamptz not null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  claimed_game_id uuid references public.attended_games(id) on delete set null,
  -- Reenvio: o convite novo que tomou o lugar deste (este fica 'revoked').
  replaced_by uuid references public.game_invites(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists game_invites_inviter_created_idx on public.game_invites (inviter_id, created_at desc);
create index if not exists game_invites_game_idx on public.game_invites (attended_game_id);
create index if not exists game_invites_claimed_by_idx on public.game_invites (claimed_by);

alter table public.game_invites enable row level security;
