import { createClient } from '@/lib/supabase-server'

export const revalidate = 60

export default async function PlacarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id, groups(*)')
    .eq('user_id', user!.id)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const group = membership?.groups as any ?? null

  if (!group) {
    return (
      <div className="px-4 pt-8 text-center">
        <div className="text-4xl mb-3">🏆</div>
        <p className="text-gray-500 text-sm">Entre em um grupo para ver o placar</p>
      </div>
    )
  }

  const { data: scoreboard } = await supabase
    .from('scoreboard')
    .select('*')
    .eq('group_id', group.id)
    .order('points', { ascending: false })

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-widest">Grupo</p>
        <p className="font-medium">{group.name}</p>
      </div>

      <div className="card p-0 overflow-hidden mb-4">
        {(scoreboard ?? []).map((row: any, i: number) => {
          const isMe = row.user_id === user!.id
          return (
            <div key={row.user_id}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0
                ${isMe ? 'bg-green-50' : ''}`}>
              <span className="text-lg w-6 text-center">{medals[i] ?? i + 1}</span>
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-sm font-medium text-green-700 flex-shrink-0">
                {row.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {row.name} {isMe && <span className="text-xs text-green-600 font-normal">(você)</span>}
                </p>
                <p className="text-xs text-gray-400">
                  {row.exact_count} exatos · {row.winner_count} vencedores · {row.bets_count} apostas
                </p>
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
