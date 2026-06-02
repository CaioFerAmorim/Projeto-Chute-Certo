import { createServiceClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

const WC_API = 'https://worldcup26.ir'

const FLAG_MAP: Record<string, string> = {
  'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷',
  'Canada': '🇨🇦', 'Switzerland': '🇨🇭', 'Qatar': '🇶🇦',
  'Brazil': '🇧🇷', 'Morocco': '🇲🇦', 'Haiti': '🇭🇹', 'Scotland': '🏴',
  'USA': '🇺🇸', 'Paraguay': '🇵🇾', 'Australia': '🇦🇺',
  'Germany': '🇩🇪', 'Curaçao': '🇨🇼', 'Ivory Coast': '🇨🇮', 'Ecuador': '🇪🇨',
  'Netherlands': '🇳🇱', 'Japan': '🇯🇵', 'Tunisia': '🇹🇳',
  'Belgium': '🇧🇪', 'Egypt': '🇪🇬', 'Iran': '🇮🇷', 'New Zealand': '🇳🇿',
  'Spain': '🇪🇸', 'Cape Verde': '🇨🇻', 'Saudi Arabia': '🇸🇦', 'Uruguay': '🇺🇾',
  'France': '🇫🇷', 'Senegal': '🇸🇳', 'Norway': '🇳🇴',
  'Argentina': '🇦🇷', 'Algeria': '🇩🇿', 'Austria': '🇦🇹', 'Jordan': '🇯🇴',
  'Portugal': '🇵🇹', 'Colombia': '🇨🇴', 'Uzbekistan': '🇺🇿',
  'England': '🇬🇧', 'Croatia': '🇭🇷', 'Ghana': '🇬🇭', 'Panama': '🇵🇦',
}

const NAME_MAP: Record<string, string> = {
  'Mexico': 'México', 'South Africa': 'África do Sul', 'South Korea': 'Coreia do Sul',
  'Canada': 'Canadá', 'Switzerland': 'Suíça', 'Qatar': 'Catar',
  'Brazil': 'Brasil', 'Morocco': 'Marrocos', 'Haiti': 'Haiti', 'Scotland': 'Escócia',
  'USA': 'Estados Unidos', 'Paraguay': 'Paraguai', 'Australia': 'Austrália',
  'Germany': 'Alemanha', 'Curaçao': 'Curaçao', 'Ivory Coast': 'Costa do Marfim',
  'Ecuador': 'Equador', 'Netherlands': 'Holanda', 'Japan': 'Japão',
  'Tunisia': 'Tunísia', 'Belgium': 'Bélgica', 'Egypt': 'Egito',
  'Iran': 'Irã', 'New Zealand': 'Nova Zelândia', 'Spain': 'Espanha',
  'Cape Verde': 'Cabo Verde', 'Saudi Arabia': 'Arábia Saudita', 'Uruguay': 'Uruguai',
  'France': 'França', 'Senegal': 'Senegal', 'Norway': 'Noruega',
  'Argentina': 'Argentina', 'Algeria': 'Argélia', 'Austria': 'Áustria',
  'Jordan': 'Jordânia', 'Portugal': 'Portugal', 'Colombia': 'Colômbia',
  'Uzbekistan': 'Uzbequistão', 'England': 'Inglaterra', 'Croatia': 'Croácia',
  'Ghana': 'Gana', 'Panama': 'Panamá',
}

function tf(name: string) { return NAME_MAP[name] || name }
function ff(name: string) { return FLAG_MAP[name] || '🏳️' }

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    // Busca jogos e times
    const [gamesRes, teamsRes] = await Promise.all([
      fetch(`${WC_API}/get/games`, { next: { revalidate: 0 } }),
      fetch(`${WC_API}/get/teams`, { next: { revalidate: 0 } }),
    ])

    const gamesData = await gamesRes.json()
    const teamsData = await teamsRes.json()

    // Mapa de id -> time
    const teamMap: Record<string, any> = {}
    const teams = Array.isArray(teamsData) ? teamsData : teamsData.teams ?? []
    teams.forEach((t: any) => { teamMap[t.id] = t })

    const games = Array.isArray(gamesData) ? gamesData : gamesData.games ?? []
    if (!games.length) {
      return NextResponse.json({ error: 'Nenhum jogo retornado', raw: gamesData }, { status: 404 })
    }

    const supabase = createServiceClient()
    let inserted = 0, updated = 0

    for (const g of games) {
      const homeTeam = teamMap[g.home_team_id]
      const awayTeam = teamMap[g.away_team_id]

      // Para jogos de mata-mata sem times definidos ainda
      const homeName = homeTeam ? tf(homeTeam.name_en) : (g.home_team_label || 'A definir')
      const awayName = awayTeam ? tf(awayTeam.name_en) : (g.away_team_label || 'A definir')
      const homeFlag = homeTeam ? ff(homeTeam.name_en) : '🏳️'
      const awayFlag = awayTeam ? ff(awayTeam.name_en) : '🏳️'

      // Converte data: "06/11/2026 13:00" (horário local EUA/México)
      const dateStr = g.local_date // ex: "06/11/2026 13:00"
      const [datePart, timePart] = dateStr.split(' ')
      const [month, day, year] = datePart.split('/')
      const kickoff = new Date(`${year}-${month}-${day}T${timePart}:00-06:00`).toISOString()

      const isFinished = g.finished === true || g.finished === 'TRUE'
      const stage = g.type === 'group' ? `Grupo ${g.group}` : g.group

      const payload = {
        api_id: parseInt(g.id),
        home_name: homeName,
        home_flag: homeFlag,
        away_name: awayName,
        away_flag: awayFlag,
        match_group: stage,
        kickoff_at: kickoff,
        status: isFinished ? 'finished' : 'scheduled',
        result_home: isFinished ? (g.home_score ?? null) : null,
        result_away: isFinished ? (g.away_score ?? null) : null,
      }

      const { data: existing } = await supabase
        .from('matches').select('id').eq('api_id', parseInt(g.id)).maybeSingle()

      if (existing) {
        await supabase.from('matches').update(payload).eq('api_id', parseInt(g.id))
        updated++
      } else {
        await supabase.from('matches').insert(payload)
        inserted++
      }
    }

    return NextResponse.json({ inserted, updated, total: games.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}