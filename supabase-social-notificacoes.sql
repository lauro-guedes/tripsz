-- tripsz.social — notificações sociais (curtidas, comentários, seguidores): guarda só QUANDO a pessoa viu pela última vez.
-- As notificações em si são lidas das tabelas follows, post_likes e post_comments. Pode rodar mais de uma vez.
alter table public.profiles add column if not exists social_notifs_seen_at timestamptz;
