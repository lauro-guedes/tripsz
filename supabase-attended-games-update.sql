-- Permite que cada pessoa edite os PRÓPRIOS jogos (Meus Jogos > Editar local).
-- Rode uma vez no SQL Editor do Supabase. Se a política já existir, o comando é ignorado.
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'attended_games' and policyname = 'attended_games_update_own'
  ) then
    create policy attended_games_update_own on public.attended_games
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
