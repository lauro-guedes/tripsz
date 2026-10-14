-- Ajustes de desempenho das políticas de segurança (RLS). Mesma regra de acesso de antes:
-- só troca auth.uid() por (select auth.uid()), que o Postgres calcula uma vez por consulta e não por linha,
-- e remove duas políticas duplicadas de trip_answers (idênticas às que ficam).
-- Rode no SQL Editor do Supabase. É tudo uma transação: se algo falhar, nada muda.
begin;
alter policy "usuário exclui seus jogos assistidos" on public.attended_games using ((select auth.uid()) = user_id);
alter policy "usuário adiciona seus jogos assistidos" on public.attended_games with check ((select auth.uid()) = user_id);
alter policy "usuário lê seus jogos assistidos" on public.attended_games using ((select auth.uid()) = user_id);
alter policy "attended_games_update_own" on public.attended_games using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "usuário vê só seus pedidos" on public.orders using ((select auth.uid()) = user_id);
alter policy "usuario le o proprio perfil" on public.profiles using ((select auth.uid()) = user_id);
alter policy "Usuário cria seu próprio slug" on public.public_profiles with check ((select auth.uid()) = user_id);
alter policy "usuário remove seus jogos salvos" on public.saved_games using ((select auth.uid()) = user_id);
alter policy "usuário salva seus jogos" on public.saved_games with check ((select auth.uid()) = user_id);
alter policy "usuário lê seus jogos salvos" on public.saved_games using ((select auth.uid()) = user_id);
alter policy "usuário lê sua própria assinatura" on public.subscriptions using ((select auth.uid()) = user_id);
alter policy "usuário apaga suas respostas" on public.trip_answers using ((select auth.uid()) = user_id);
alter policy "usuário cria suas respostas" on public.trip_answers with check ((select auth.uid()) = user_id);
alter policy "usuário vê só suas respostas" on public.trip_answers using ((select auth.uid()) = user_id);
alter policy "usuário atualiza suas respostas" on public.trip_answers using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy "usuário exclui suas respostas" on public.trip_answers;  -- duplicada de "usuário apaga suas respostas"
drop policy "usuário edita suas respostas" on public.trip_answers;   -- duplicada de "usuário atualiza suas respostas"
commit;
