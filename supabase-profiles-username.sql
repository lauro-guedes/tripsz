-- @usuário único + nome/sobrenome. Rode UMA vez no SQL Editor do Supabase.
-- Cria public.profiles, funções que geram o @ sem repetir e um gatilho em auth.users
-- (cobre cadastro por e-mail e por Google). Preenche os usuários que já existem.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  first_name text,
  last_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$' and username !~ '[._]{2}')
);
create unique index if not exists profiles_username_key on public.profiles (username);
alter table public.profiles enable row level security;
drop policy if exists "usuario le o proprio perfil" on public.profiles;
create policy "usuario le o proprio perfil" on public.profiles for select using (auth.uid() = user_id);

create or replace function public.username_reserved(u text) returns boolean
language sql immutable set search_path = public as $$
  select u = any (array['admin','administrador','tripsz','api','app','suporte','support','ajuda','help','root','www','login','conta','perfil','passaporte','contato','oficial','equipe','staff','u','null','undefined','anonimo']);
$$;

create or replace function public.username_base(first_name text, last_name text) returns text
language plpgsql immutable set search_path = public as $$
declare
  f text; l text; b text;
begin
  f := regexp_replace(translate(lower(coalesce(first_name,'')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]', '', 'g');
  l := regexp_replace(translate(lower(coalesce(last_name,'')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]', '', 'g');
  b := case when f <> '' and l <> '' then f || '.' || l else f || l end;
  b := left(b, 20);
  b := regexp_replace(b, '[._]+$', '');
  if length(b) < 3 then b := 'torcedor'; end if;
  return b;
end;
$$;

create or replace function public.username_valid(u text) returns boolean
language sql immutable set search_path = public as $$
  select u ~ '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$' and u !~ '[._]{2}' and not public.username_reserved(u);
$$;

create or replace function public.unique_username(base text) returns text
language plpgsql set search_path = public as $$
declare
  candidate text := base; i int := 0;
begin
  while i < 60 loop
    if public.username_valid(candidate) and not exists (select 1 from public.profiles where username = candidate) then
      return candidate;
    end if;
    i := i + 1;
    candidate := left(base, case when i < 20 then 17 else 14 end) || floor(random() * case when i < 20 then 1000 else 100000 end)::int::text;
  end loop;
  return 'torcedor' || substr(md5(random()::text), 1, 10);
end;
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text; f text; l text; wanted text; chosen text;
begin
  full_name := nullif(trim(coalesce(m->>'full_name', m->>'name', '')), '');
  f := nullif(trim(coalesce(m->>'first_name', m->>'given_name', split_part(coalesce(full_name, ''), ' ', 1))), '');
  l := nullif(trim(coalesce(m->>'last_name', m->>'family_name', nullif(regexp_replace(coalesce(full_name, ''), '^\S+\s*', ''), ''))), '');
  wanted := ltrim(lower(trim(coalesce(m->>'username', ''))), '@');
  if wanted <> '' and public.username_valid(wanted) and not exists (select 1 from public.profiles where username = wanted) then
    chosen := wanted;
  else
    chosen := public.unique_username(public.username_base(coalesce(f, split_part(new.email, '@', 1)), l));
  end if;
  begin
    insert into public.profiles (user_id, username, first_name, last_name) values (new.id, chosen, f, l);
  exception when unique_violation then
    insert into public.profiles (user_id, username, first_name, last_name)
    values (new.id, public.unique_username(public.username_base(coalesce(f, 'torcedor'), l)), f, l)
    on conflict do nothing;
  end;
  return new;
exception when others then
  raise warning 'handle_new_user falhou: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Preenche quem já existe
do $$
declare r record; m jsonb; full_name text; f text; l text;
begin
  for r in select * from auth.users u where not exists (select 1 from public.profiles p where p.user_id = u.id) loop
    m := coalesce(r.raw_user_meta_data, '{}'::jsonb);
    full_name := nullif(trim(coalesce(m->>'full_name', m->>'name', '')), '');
    f := nullif(trim(coalesce(m->>'given_name', split_part(coalesce(full_name, ''), ' ', 1))), '');
    l := nullif(trim(coalesce(m->>'family_name', nullif(regexp_replace(coalesce(full_name, ''), '^\S+\s*', ''), ''))), '');
    insert into public.profiles (user_id, username, first_name, last_name)
    values (r.id, public.unique_username(public.username_base(coalesce(f, split_part(r.email, '@', 1)), l)), f, l);
  end loop;
end $$;
