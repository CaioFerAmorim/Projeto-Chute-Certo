'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function PlacarPage() {
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)

      const { data: membership } = await supabase
        .from('group_members').select('group_id, groups(*)')
        .eq('user_id', user.id).order('joined_at', { ascending: false }).limit(1).maybeSingle()

      const group = (membership as any)?.groups ?? null
      if (!group) { setData({ group: null, scoreboard: [] }); setLoading(false); return }

      const [{ data: scoreboard }, { data: members }] = await Promise.all([
        supabase.from('scoreboard').select('*').eq('group_id', group.id).order('points', { ascending: false }),
        supabase.from('group_members').select('user_id, profiles(id, avatar_url)').eq('group_id', group.id),
      ])

      // Junta avatar_url no scoreboard
      const avatarMap: Record<string, string> = {}
      ;(members ?? []).forEach((m: any) => {
        if (m.profiles?.avatar_url) avatarMap[m.user_id] = m.profiles.avatar_url
      })

      const enriched = (scoreboard ?? []).map((row: any) => ({
        ...row,
        avatar_url: avatarMap[row.user_id] ?? null,
      }))

      setData({ group, scoreboard: enriched })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>
  if (!data?.group) return (
    <div className="px-4 pt-8 text-center">
      <div className="text-4xl mb-3">🏆</div>
      <p className="text-gray-500 text-sm">Entre em um grupo para ver o placar</p>
    </div>
  )

  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-widest">Grupo</p>
        <p className="font-medium">{data.group.name}</p>
      </div>
      <div className="card p-0 overflow-hidden mb-4">
        {data.scoreboard.map((row: any, i: number) => {
          const isMe = row.user_id === userId
          return (
            <div key={row.user_id} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${isMe ? 'bg-green-50' : ''}`}>
              <span className="text-lg w-6 text-center">{medals[i] ?? i + 1}</span>
              {row.avatar_url
                ? <img src={row.avatar_url} alt={row.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                : <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-sm font-medium text-green-700 flex-shrink-0">
                    {row.name.substring(0, 2).toUpperCase()}
                  </div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {row.name} {isMe && <span className="text-xs text-green-600 font-normal">(você)</span>}
                </p>
                <p className="text-xs text-gray-400">{row.exact_count} exatos · {row.winner_count} vencedores · {row.bets_count} apostas</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-medium">{row.points}</p>
                <p className="text-xs text-gray-400">pts</p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="card">
        <p className="sec-label">Pontuação</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">🎯 Placar exato</span><span className="font-medium text-green-700">3 pts</span></div>
          <div className="flex justify-between"><span className="text-gray-500">✓ Vencedor / empate</span><span className="font-medium text-amber-600">1 pt</span></div>
          <div className="flex justify-between"><span className="text-gray-500">✗ Errou</span><span className="text-gray-400">0 pts</span></div>
        </div>
      </div>
    </div>
  )
}