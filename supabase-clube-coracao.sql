-- Clube do coração no perfil (aditivo, pode rodar de novo).
alter table public.profiles add column if not exists heart_club_name text, add column if not exists heart_club_logo text;
