-- ============================================================
-- CHUTE CERTO — Schema completo
-- Execute no Supabase: SQL Editor > New Query > Run
-- ============================================================

-- Extensão para UUIDs
create extension if not exists "pgcrypto";

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfis de usuário (complementa auth.users do Supabase)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  name        text not null,
  created_at  timestamptz default now()
);

-- Grupos de bolão
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text unique not null,           -- código de 6 chars para convite
  admin_id    uuid not null references public.profiles(id),
  created_at  timestamptz default now()
);

-- Membros de cada grupo
create table public.group_members (
  group_id    uuid not null references public.groups(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  joined_at   timestamptz default now(),
  primary key (group_id, user_id)
);

-- Jogos (populados manualmente ou via API)
create table public.matches (
  id              uuid primary key default gen_random_uuid(),
  api_id          integer unique,             -- ID do jogo na API-Football
  home_name       text not null,
  home_flag       text not null,             -- emoji da bandeira
  away_name       text not null,
  away_flag       text not null,
  match_group     text not null,             -- "Grupo A", "Semifinal", etc.
  kickoff_at      timestamptz not null,
  result_home     integer,                   -- null até o jogo terminar
  result_away     integer,
  status          text default 'scheduled',  -- scheduled | live | finished
  created_at      timestamptz default now()
);

-- Apostas
create table public.bets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  group_id    uuid not null references public.groups(id) on delete cascade,
  match_id    uuid not null references public.matches(id) on delete cascade,
  home_goals  integer not null check (home_goals >= 0),
  away_goals  integer not null check (away_goals >= 0),
  placed_at   timestamptz default now(),
  unique (user_id, group_id, match_id)
);

-- ============================================================
-- FUNÇÃO: calcular pontos de uma aposta
-- ============================================================
create or replace function calc_points(
  bet_home integer, bet_away integer,
  res_home integer, res_away integer
) returns integer language plpgsql immutable as $$
declare
  bet_winner integer;
  res_winner integer;
begin
  if res_home is null or res_away is null then return 0; end if;
  -- Placar exato = 3 pts
  if bet_home = res_home and bet_away = res_away then return 3; end if;
  -- Vencedor/empate certo = 1 pt
  bet_winner := case when bet_home > bet_away then 1 when bet_home < bet_away then -1 else 0 end;
  res_winner  := case when res_home > res_away then 1 when res_home < res_away then -1 else 0 end;
  if bet_winner = res_winner then return 1; end if;
  return 0;
end;
$$;

-- ============================================================
-- VIEW: scoreboard por grupo
-- ============================================================
create or replace view public.scoreboard as
select
  gm.group_id,
  p.id as user_id,
  p.username,
  p.name,
  coalesce(sum(
    calc_points(b.home_goals, b.away_goals, m.result_home, m.result_away)
  ), 0) as points,
  count(b.id) as bets_count,
  count(case when calc_points(b.home_goals, b.away_goals, m.result_home, m.result_away) = 3 then 1 end) as exact_count,
  count(case when calc_points(b.home_goals, b.away_goals, m.result_home, m.result_away) = 1 then 1 end) as winner_count
from public.group_members gm
join public.profiles p on p.id = gm.user_id
left join public.bets b on b.user_id = gm.user_id and b.group_id = gm.group_id
left join public.matches m on m.id = b.match_id
group by gm.group_id, p.id, p.username, p.name;

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.matches       enable row level security;
alter table public.bets          enable row level security;

-- Profiles: leitura pública, escrita própria
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update" on public.profiles for update using (id = auth.uid());

-- Groups: qualquer autenticado pode criar e ver
create policy "groups_select" on public.groups for select using (true);
create policy "groups_insert" on public.groups for insert with check (auth.uid() is not null);

-- Group members: ver todos, inserir a si mesmo
create policy "members_select" on public.group_members for select using (true);
create policy "members_insert" on public.group_members for insert with check (user_id = auth.uid());
create policy "members_delete" on public.group_members for delete using (user_id = auth.uid());

-- Matches: leitura pública (escrita só via service role no cron)
create policy "matches_select" on public.matches for select using (true);

-- Bets: ver do próprio grupo, inserir/atualizar as próprias
create policy "bets_select" on public.bets for select
  using (exists (
    select 1 from public.group_members gm
    where gm.group_id = bets.group_id and gm.user_id = auth.uid()
  ));
create policy "bets_insert" on public.bets for insert
  with check (
    user_id = auth.uid() and
    exists (select 1 from public.group_members gm where gm.group_id = bets.group_id and gm.user_id = auth.uid()) and
    exists (select 1 from public.matches m where m.id = match_id and now() < m.kickoff_at)
  );
create policy "bets_update" on public.bets for update
  using (
    user_id = auth.uid() and
    exists (select 1 from public.matches m where m.id = match_id and now() < m.kickoff_at)
  );

-- ============================================================
-- DADOS INICIAIS — Jogos da Copa 2026 (fase de grupos, amostra)
-- Substitua os kickoff_at pelas datas reais quando anunciadas
-- ============================================================
insert into public.matches (home_name, home_flag, away_name, away_flag, match_group, kickoff_at, api_id) values
  ('Brasil',       '🇧🇷', 'Argentina',    '🇦🇷', 'Grupo A', '2026-06-15 21:00:00-03', 1001),
  ('França',       '🇫🇷', 'Alemanha',     '🇩🇪', 'Grupo B', '2026-06-16 18:00:00-03', 1002),
  ('Espanha',      '🇪🇸', 'Portugal',     '🇵🇹', 'Grupo C', '2026-06-16 21:00:00-03', 1003),
  ('Inglaterra',   '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Holanda',      '🇳🇱', 'Grupo D', '2026-06-17 18:00:00-03', 1004),
  ('Uruguai',      '🇺🇾', 'Colômbia',     '🇨🇴', 'Grupo E', '2026-06-17 21:00:00-03', 1005),
  ('Japão',        '🇯🇵', 'Coreia do Sul','🇰🇷', 'Grupo F', '2026-06-18 15:00:00-03', 1006)
on conflict do nothing;
