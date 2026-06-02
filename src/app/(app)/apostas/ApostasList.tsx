'use client'
import { useState, useEffect } from 'react'
import { Match, Bet, calcPoints, isLocked, fmtDate } from '@/types'
import { createClient } from '@/lib/supabase-browser'

interface Props {
  matches: Match[]
  group: { id: string; name: string; code: string; admin_id: string } | null
  bets: Bet[]
  userId: string
  onRefresh: () => void
}

export default function ApostasList({ matches, group, bets, userId, onRefresh }: Props) {
  const supabase = createClient()
  const [scores, setScores] = useState<Record<string, { h: string; a: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [groupBets, setGroupBets] = useState<Record<string, any[]>>({})
  const [loadingBets, setLoadingBets] = useState<string | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [filter, setFilter] = useState<'todos' | 'abertos' | 'encerrados' | 'semana'>('todos')
  const [serverLocked, setServerLocked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!group) return
    supabase
      .from('group_members')
      .select('user_id, profiles(name, id)')
      .eq('group_id', group.id)
      .then(({ data }) => setMembers((data ?? []).map((m: any) => m.profiles)))
  }, [group?.id])

  function betFor(matchId: string) {
    return bets.find(b => b.match_id === matchId)
  }

  function getScore(matchId: string, side: 'h' | 'a') {
    if (scores[matchId]?.[side] !== undefined) return scores[matchId][side]
    const bet = betFor(matchId)
    if (!bet) return ''
    return String(side === 'h' ? bet.home_goals : bet.away_goals)
  }

  function setScore(matchId: string, side: 'h' | 'a', val: string) {
    setScores(prev => ({
      ...prev,
      [matchId]: { h: getScore(matchId, 'h'), a: getScore(matchId, 'a'), [side]: val },
    }))
  }

  async function saveBet(match: Match) {
    if (!group) return
    const { data: fresh } = await supabase
      .from('matches').select('kickoff_at, status, result_home').eq('id', match.id).single()
    if (!fresh || isLocked(fresh.kickoff_at) || fresh.result_home !== null || fresh.status === 'finished') {
      setServerLocked(prev => ({ ...prev, [match.id]: true }))
      setScores(prev => ({ ...prev, [match.id]: { h: '', a: '' } }))
      onRefresh()
      return setMsg({ type: 'err', text: 'Apostas fechadas para esse jogo' })
    }
    const h = parseInt(getScore(match.id, 'h'))
    const a = parseInt(getScore(match.id, 'a'))
    if (isNaN(h) || isNaN(a)) return setMsg({ type: 'err', text: 'Preencha os dois placares' })
    setSaving(match.id)
    const existing = betFor(match.id)
    const payload = { user_id: userId, group_id: group.id, match_id: match.id, home_goals: h, away_goals: a }
    const { error } = existing
      ? await supabase.from('bets').update({ home_goals: h, away_goals: a }).eq('id', existing.id)
      : await supabase.from('bets').insert(payload)
    setSaving(null)
    if (error) return setMsg({ type: 'err', text: 'Erro ao salvar aposta' })
    setMsg({ type: 'ok', text: 'Aposta salva!' })
    setTimeout(() => setMsg(null), 2000)
    onRefresh()
  }

  async function toggleExpand(matchId: string) {
    const isOpen = expanded[matchId]
    setExpanded(prev => ({ ...prev, [matchId]: !isOpen }))
    if (!isOpen && !groupBets[matchId] && group) {
      setLoadingBets(matchId)
      const { data } = await supabase
        .from('bets')
        .select('home_goals, away_goals, user_id, profiles(name)')
        .eq('match_id', matchId)
        .eq('group_id', group.id)
      setGroupBets(prev => ({ ...prev, [matchId]: data ?? [] }))
      setLoadingBets(null)
    }
  }

  if (!group) {
    return (
      <div className="px-4 pt-8 text-center">
        <div className="text-4xl mb-3">👥</div>
        <p className="text-gray-500 text-sm mb-4">Entre em um grupo para fazer apostas</p>
        <a href="/grupo" className="btn btn-primary text-sm">Ir para Grupos</a>
      </div>
    )
  }

  const filteredMatches = matches.filter(m => {
    if (m.home_name.startsWith('Winner') || m.home_name.startsWith('Runner') ||
      m.home_name.startsWith('Loser') || m.home_name.startsWith('3rd') ||
      m.away_name.startsWith('Winner') || m.away_name.startsWith('Runner') ||
      m.away_name.startsWith('Loser') || m.away_name.startsWith('3rd')) return false
    const locked = isLocked(m.kickoff_at)
    const finished = m.status === 'finished' || m.result_home !== null
    const kick = new Date(m.kickoff_at)
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)
    if (filter === 'abertos') return !locked
    if (filter === 'encerrados') return finished
    if (filter === 'semana') return kick >= startOfWeek && kick <= endOfWeek
    return true
  })

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Grupo</p>
          <p className="font-medium text-sm">{group.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && (
            <div className={`text-xs px-3 py-1.5 rounded-full ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {msg.text}
            </div>
          )}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as any)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-500 cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-400">
            <option value="todos">Todos</option>
            <option value="semana">Semanal</option>
            <option value="abertos">Abertos</option>
            <option value="encerrados">Encerrados</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {filteredMatches.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">Nenhum jogo nesse filtro</div>
        )}
        {filteredMatches.map(m => {
          const locked = isLocked(m.kickoff_at)
          const finished = m.status === 'finished' || (m.result_home !== null)
          const bet = betFor(m.id)
          const pts = bet && finished ? calcPoints(bet.home_goals, bet.away_goals, m.result_home, m.result_away) : null
          const isExpanded = expanded[m.id]
          const matchGroupBets = groupBets[m.id] ?? []

          return (
            <div key={m.id} className={`card ${locked && !finished ? 'opacity-70' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400">{m.match_group}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{fmtDate(m.kickoff_at)}</span>
                  {finished
                    ? <span className="badge-done">encerrado</span>
                    : locked
                    ? <span className="badge-locked">🔒 fechado</span>
                    : <span className="badge-open">aberto</span>}
                </div>
              </div>

              {finished && m.result_home !== null && (
                <div className="text-center mb-3 py-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-0.5">Resultado oficial</p>
                  <p className="text-2xl font-medium">{m.result_home} × {m.result_away}</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <span className="text-3xl">{m.home_flag}</span>
                  <p className="text-xs text-gray-500 mt-1">{m.home_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={20}
                    value={getScore(m.id, 'h')}
                    onChange={e => setScore(m.id, 'h', e.target.value)}
                    disabled={locked}
                    className="w-12 text-center text-xl font-medium input py-1.5 px-1 disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="0" />
                  <span className="text-gray-300 text-lg">×</span>
                  <input type="number" min={0} max={20}
                    value={getScore(m.id, 'a')}
                    onChange={e => setScore(m.id, 'a', e.target.value)}
                    disabled={locked}
                    className="w-12 text-center text-xl font-medium input py-1.5 px-1 disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="0" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-3xl">{m.away_flag}</span>
                  <p className="text-xs text-gray-500 mt-1">{m.away_name}</p>
                </div>
              </div>

              {!locked && !finished && (
                <button className="btn btn-primary w-full mt-3 text-sm" onClick={() => saveBet(m)} disabled={saving === m.id}>
                  {saving === m.id ? 'Salvando...' : bet ? 'Atualizar aposta' : 'Salvar aposta'}
                </button>
              )}

              {bet && finished && pts !== null && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 text-xs">
                  <span className="text-gray-400">Sua aposta: {bet.home_goals} × {bet.away_goals}</span>
                  <span className={pts === 3 ? 'pts-exact' : pts === 1 ? 'pts-winner' : 'pts-zero'}>
                    {pts === 3 ? '🎯 +3' : pts === 1 ? '✓ +1' : '✗ 0 pts'}
                  </span>
                </div>
              )}

              {bet && !finished && !locked && !serverLocked[m.id] && (
                <p className="text-xs text-green-600 text-center mt-2">✓ aposta salva</p>
              )}
              {bet && !finished && (locked || serverLocked[m.id]) && (
                <p className="text-xs text-amber-600 text-center mt-2">⚠️ apostas encerradas para esse jogo</p>
              )}
              {!bet && (locked || serverLocked[m.id]) && !finished && (
                <p className="text-xs text-red-400 text-center mt-2">⚠️ você não apostou nesse jogo</p>
              )}

              <button
                onClick={() => toggleExpand(m.id)}
                className="w-full flex items-center justify-center gap-1 mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                {isExpanded ? '▲ ocultar apostas do grupo' : '▼ ver apostas do grupo'}
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-1">
                  {loadingBets === m.id ? (
                    <p className="text-xs text-gray-400 text-center py-2">Carregando...</p>
                  ) : (
                    <>
                      {members
                        .filter(mb => !matchGroupBets.find((b: any) => b.user_id === mb.id))
                        .map((mb: any) => (
                          <div key={mb.id} className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded-lg text-xs">
                            <span className="text-gray-400">{mb.name}</span>
                            <span className="text-gray-300 italic">não apostou</span>
                          </div>
                        ))}
                      {matchGroupBets.map((o: any, i: number) => {
                        const oName = (o.profiles as any)?.name ?? 'Anônimo'
                        const isMe = o.user_id === userId
                        const oPts = finished ? calcPoints(o.home_goals, o.away_goals, m.result_home, m.result_away) : null
                        const showScore = locked || isMe
                        return (
                          <div key={i} className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded-lg text-xs">
                            <span className="text-gray-600 font-medium">{oName}{isMe ? ' (você)' : ''}</span>
                            <div className="flex items-center gap-2">
                              {showScore
                                ? <span className="font-mono">{o.home_goals} × {o.away_goals}</span>
                                : <span className="text-gray-300 italic">apostou ✓</span>}
                              {oPts !== null && (
                                <span className={oPts === 3 ? 'pts-exact' : oPts === 1 ? 'pts-winner' : 'pts-zero'}>
                                  {oPts > 0 ? `+${oPts}` : '0'}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}