import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

// Este endpoint é chamado pelo Vercel Cron a cada 5 minutos
// Configurado em vercel.json

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'

async function fetchFixture(apiId: number) {
  const res = await fetch(`${API_FOOTBALL_BASE}/fixtures?id=${apiId}`, {
    headers: {
      'x-rapidapi-key': process.env.API_FOOTBALL_KEY!,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.response?.[0] ?? null
}

export async function GET(req: NextRequest) {
  // Verifica segredo para evitar chamadas não autorizadas
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Busca jogos sem resultado que já começaram
  const now = new Date().toISOString()
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, api_id, kickoff_at, status')
    .lt('kickoff_at', now)
    .neq('status', 'finished')
    .not('api_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!matches?.length) return NextResponse.json({ updated: 0 })

  let updated = 0

  for (const match of matches) {
    try {
      const fixture = await fetchFixture(match.api_id!)
      if (!fixture) continue

      const fixtureStatus = fixture.fixture.status.short
      // FT = Full Time, AET = After Extra Time, PEN = Penalties
      const isFinished = ['FT', 'AET', 'PEN'].includes(fixtureStatus)
      const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(fixtureStatus)

      const homeGoals = fixture.goals.home
      const awayGoals = fixture.goals.away

      if (homeGoals === null && awayGoals === null) continue

      const updateData: any = {
        status: isFinished ? 'finished' : isLive ? 'live' : 'scheduled',
        result_home: isFinished ? homeGoals : null,
        result_away: isFinished ? awayGoals : null,
      }

      await supabase.from('matches').update(updateData).eq('id', match.id)
      updated++
    } catch (e) {
      console.error(`Erro ao atualizar jogo ${match.id}:`, e)
    }
  }

  return NextResponse.json({ updated, checked: matches.length })
}
