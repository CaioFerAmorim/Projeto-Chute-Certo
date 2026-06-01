import { createClient } from '@/lib/supabase-server'
import ApostasList from './ApostasList'

export const revalidate = 60

export default async function ApostasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Busca perfil, grupo ativo e jogos
  const [{ data: profile }, { data: matches }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('matches').select('*').order('kickoff_at'),
  ])

  // Grupo ativo do usuário (primeiro que está)
  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id, groups(*)')
    .eq('user_id', user!.id)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const group = membership?.groups as any ?? null

  // Apostas do usuário nesse grupo
  let bets: any[] = []
  if (group) {
    const { data } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', user!.id)
      .eq('group_id', group.id)
    bets = data ?? []
  }

  return (
    <ApostasList
      matches={matches ?? []}
      group={group}
      bets={bets}
      userId={user!.id}
    />
  )
}
