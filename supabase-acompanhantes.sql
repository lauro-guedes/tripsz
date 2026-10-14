-- "Quem foi com você?" — marcar amigos que JÁ têm conta (fase 2).
--
-- Quem é marcado NÃO recebe o jogo sozinho: aparece um aviso ("Fulano te marcou em [jogo]") com
-- "Adicionar ao meu Passaporte" e "Ignorar". Assim ninguém grava dado em conta alheia sem consentimento
-- nem infla o XP de outra pessoa com jogos falsos. (Quem NÃO tem conta entra por convite: game_invites.)
--
-- Só o SERVIDOR (chave service_role) lê e grava: RLS ligado e SEM política, como as outras tabelas de cache/convite.
create table if not exists public.game_companions (
  id uuid primary key default gen_random_uuid(),
  -- Jogo de quem marcou. Se ele apagar o jogo, a marcação some junto (não sobra aviso de jogo que não existe mais).
  attended_game_id uuid not null references public.attended_games(id) on delete cascade,
  tagger_id uuid not null references auth.users(id) on delete cascade,
  companion_id uuid not null references auth.users(id) on delete cascade,
  -- 'pending' (aguardando aceite) | 'accepted' | 'ignored'. Quem marcou nunca vê 'ignored': para ele continua "aguardando".
  status text not null default 'pending' check (status in ('pending', 'accepted', 'ignored')),
  -- Cópia dos dados do jogo no momento da marcação (times, placar, estádio, data...): é o que o aviso mostra e o que entra no Passaporte.
  game_snapshot jsonb not null,
  -- O jogo que entrou no Passaporte de quem aceitou.
  accepted_game_id uuid references public.attended_games(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint game_companions_not_self check (tagger_id <> companion_id),
  constraint game_companions_once unique (attended_game_id, companion_id)
);

create index if not exists game_companions_companion_idx on public.game_companions (companion_id, status, created_at desc);
create index if not exists game_companions_tagger_idx on public.game_companions (tagger_id, created_at desc);
create index if not exists game_companions_game_idx on public.game_companions (attended_game_id);

alter table public.game_companions enable row level security;
