'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Match, Bet, calcPoints, isLocked, fmtDate } from '@/types'
import { createClient } from '@/lib/supabase-browser'

interface Props {
  matches: Match[]
  group: { id: string; name: string; code: string; admin_id: string } | null
  bets: Bet[]
  userId: string
}

export default function ApostasList({ matches, group, bets, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [scores, setScores] = useState<Record<string, { h: string; a: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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
    if (isLocked(match.kickoff_at)) return setMsg({ type: 'err', text: 'Apostas fechadas para esse jogo' })
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
    router.refresh()
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

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Grupo</p>
          <p className="font-medium text-sm">{group.name}</p>
        </div>
        {msg && (
          <div className={`text-xs px-3 py-1.5 rounded-full ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {msg.text}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {matches.map(m => {
          const locked = isLocked(m.kickoff_at)
          const finished = m.status === 'finished' || (m.result_home !== null)
          const bet = betFor(m.id)
          const pts = bet && finished ? calcPoints(bet.home_goals, bet.away_goals, m.result_home, m.result_away) : null

          return (
            <div key={m.id} className={`card ${locked && !finished ? 'opacity-70' : ''}`}>
              {/* Header */}
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

              {/* Resultado real */}
              {finished && m.result_home !== null && (
                <p className="text-center text-xs text-gray-400 mb-2">
                  Resultado: <strong className="text-gray-700">{m.result_home} × {m.result_away}</strong>
                </p>
              )}

              {/* Times + inputs */}
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <span className="text-3xl">{m.home_flag}</span>
                  <p className="text-xs text-gray-500 mt-1">{m.home_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={20}
                    value={getScore(m.id, 'h')}
                    onChange={e => setScore(m.id, 'h', e.target.value)}
                    disabled={locked}
                    className="w-12 text-center text-xl font-medium input py-1.5 px-1 disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="0"
                  />
                  <span className="text-gray-300 text-lg">×</span>
                  <input
                    type="number" min={0} max={20}
                    value={getScore(m.id, 'a')}
                    onChange={e => setScore(m.id, 'a', e.target.value)}
                    disabled={locked}
                    className="w-12 text-center text-xl font-medium input py-1.5 px-1 disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="0"
                  />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-3xl">{m.away_flag}</span>
                  <p className="text-xs text-gray-500 mt-1">{m.away_name}</p>
                </div>
              </div>

              {/* Footer: salvar ou resultado */}
              {!locked && !finished && (
                <button
                  className="btn btn-primary w-full mt-3 text-sm"
                  onClick={() => saveBet(m)}
                  disabled={saving === m.id}>
                  {saving === m.id ? 'Salvando...' : bet ? 'Atualizar aposta' : 'Salvar aposta'}
                </button>
              )}

              {bet && finished && pts !== null && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 text-xs">
                  <span className="text-gray-400">Sua aposta: {bet.home_goals} × {bet.away_goals}</span>
                  <span className={pts === 3 ? 'pts-exact' : pts === 1 ? 'pts-winner' : 'pts-zero'}>
                    {pts === 3 ? '🎯 placar exato +3' : pts === 1 ? '✓ vencedor certo +1' : '✗ 0 pts'}
                  </span>
                </div>
              )}

              {bet && !finished && !locked && (
                <p className="text-xs text-green-600 text-center mt-2">✓ aposta salva</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
