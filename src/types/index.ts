export type Profile = {
  id: string
  username: string
  name: string
  created_at: string
}

export type Group = {
  id: string
  name: string
  code: string
  admin_id: string
  created_at: string
}

export type GroupMember = {
  group_id: string
  user_id: string
  joined_at: string
}

export type Match = {
  id: string
  api_id: number | null
  home_name: string
  home_flag: string
  away_name: string
  away_flag: string
  match_group: string
  kickoff_at: string
  result_home: number | null
  result_away: number | null
  status: 'scheduled' | 'live' | 'finished'
  created_at: string
}

export type Bet = {
  id: string
  user_id: string
  group_id: string
  match_id: string
  home_goals: number
  away_goals: number
  placed_at: string
}

export type ScoreboardRow = {
  group_id: string
  user_id: string
  username: string
  name: string
  points: number
  bets_count: number
  exact_count: number
  winner_count: number
}

export function calcPoints(
  betHome: number, betAway: number,
  resHome: number | null, resAway: number | null
): 0 | 1 | 3 {
  if (resHome === null || resAway === null) return 0
  if (betHome === resHome && betAway === resAway) return 3
  const bW = betHome > betAway ? 1 : betHome < betAway ? -1 : 0
  const rW = resHome > resAway ? 1 : resHome < resAway ? -1 : 0
  if (bW === rW) return 1
  return 0
}

export function isLocked(kickoff_at: string): boolean {
  return new Date() >= new Date(kickoff_at)
}

export function fmtDate(kickoff_at: string): string {
  return new Date(kickoff_at).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}
