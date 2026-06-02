'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { calcPoints } from '@/types'

export default function PerfilPage() {
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const [{ data: profile }, { data: membership }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('group_members').select('group_id').eq('user_id', user.id)
          .order('joined_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      const groupId = (membership as any)?.group_id ?? null
      let bets: any[] = [], matches: any[] = []
      let score = { points: 0, exact: 0, winner: 0, bets: 0 }

      if (groupId) {
        const [{ data: b }, { data: m }] = await Promise.all([
          supabase.from('bets').select('*').eq('user_id', user.id).eq('group_id', groupId),
          supabase.from('matches').select('*').order('kickoff_at'),
        ])
        bets = b ?? []; matches = m ?? []
        bets.forEach(bet => {
          const match = matches.find((m: any) => m.id === bet.match_id)
          if (!match) return
          score.bets++
          const pts = calcPoints(bet.home_goals, bet.away_goals, match.result_home, match.result_away)
          score.points += pts
          if (pts === 3) score.exact++
          if (pts === 1) score.winner++
        })
      }

      setData({ profile, score, bets, matches, groupId })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>

  const { profile, score, bets, matches, groupId } = data
  const finishedMatches = matches.filter((m: any) => m.result_home !== null)

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="px-4 py-4">
      <div className="card mb-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-xl font-medium text-green-700 flex-shrink-0">
          {profile?.name?.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-base">{profile?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { n: score.points, l: 'pontos totais' },
          { n: score.bets,   l: 'apostas feitas' },
          { n: score.exact,  l: 'placares exatos' },
          { n: score.winner, l: 'vencedores certos' },
        ].map(s => (
          <div key={s.l} className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-medium">{s.n}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      {finishedMatches.length > 0 && (
        <div className="card mb-4">
          <p className="sec-label">Meus resultados</p>
          {finishedMatches.map((m: any) => {
            const bet = bets.find((b: any) => b.match_id === m.id)
            const pts = bet ? calcPoints(bet.home_goals, bet.away_goals, m.result_home, m.result_away) : null
            return (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                <div className="flex items-center gap-2">
                  <span>{m.home_flag}{m.away_flag}</span>
                  <span className="text-gray-500 text-xs">{m.home_name} × {m.away_name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400">{bet ? `${bet.home_goals}×${bet.away_goals}` : '—'}</span>
                  {pts !== null ? (
                    <span className={pts === 3 ? 'pts-exact' : pts === 1 ? 'pts-winner' : 'pts-zero'}>
                      {pts > 0 ? `+${pts}` : '0'}
                    </span>
                  ) : <span className="pts-zero">—</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card mb-4">
        <p className="sec-label">Regras de pontuação</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">🎯 Placar exato</span><span className="font-medium text-green-700">3 pts</span></div>
          <div className="flex justify-between"><span className="text-gray-500">✓ Vencedor / empate</span><span className="font-medium text-amber-600">1 pt</span></div>
          <div className="flex justify-between"><span className="text-gray-500">✗ Errou</span><span className="text-gray-400">0 pts</span></div>
          <div className="pt-2 border-t border-gray-100 text-xs text-gray-400">🔒 Apostas fecham no minuto em que o jogo começa</div>
        </div>
      </div>

      <button className="btn w-full text-gray-400 text-sm" onClick={logout}>Sair da conta</button>
    </div>
  )
}