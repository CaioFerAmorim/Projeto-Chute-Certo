import { createClient } from '@/lib/supabase-server'
import GrupoClient from './GrupoClient'

export default async function GrupoPage() {
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

  let members: any[] = []
  if (group) {
    const { data } = await supabase
      .from('group_members')
      .select('user_id, profiles(*)')
      .eq('group_id', group.id)
    members = (data ?? []).map((m: any) => m.profiles)
  }

  return <GrupoClient group={group} members={members} userId={user!.id} />
}
