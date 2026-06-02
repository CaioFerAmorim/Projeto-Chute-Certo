import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Busca jogos sem resultado que já começaram
  const now = new Date().toISOString()
  const { data: matches } = await supabase
    .from('matches')
    .select('id, api_id, kickoff_at, status')
    .lt('kickoff_at', now)
    .neq('status', 'finished')
    .not('api_id', 'is', null)

  if (!matches?.length) return NextResponse.json({ updated: 0 })

  // Busca todos os jogos da API
  const res = await fetch('https://worldcup26.ir/get/games', { next: { revalidate: 0 } })
  const data = await res.json()
  const games = Array.isArray(data) ? data : data.games ?? []

  const gameMap: Record<number, any> = {}
  games.forEach((g: any) => { gameMap[parseInt(g.id)] = g })

  let updated = 0
  for (const match of matches) {
    const g = gameMap[match.api_id!]
    if (!g) continue

    const isFinished = g.finished === true || g.finished === 'TRUE'
    if (!isFinished) continue

    await supabase.from('matches').update({
      status: 'finished',
      result_home: g.home_score ?? 0,
      result_away: g.away_score ?? 0,
    }).eq('id', match.id)

    updated++
  }

  return NextResponse.json({ updated, checked: matches.length })
}