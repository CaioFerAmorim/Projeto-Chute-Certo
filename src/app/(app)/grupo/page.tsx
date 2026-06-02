'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import GrupoClient from './GrupoClient'

export default function GrupoPage() {
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const { data: membership } = await supabase
      .from('group_members').select('group_id, groups(*)')
      .eq('user_id', user.id).order('joined_at', { ascending: false }).limit(1).maybeSingle()

    const group = (membership as any)?.groups ?? null
    let members: any[] = []
    if (group) {
      const { data: m } = await supabase
        .from('group_members').select('user_id, profiles(id, name, avatar_url)')
        .eq('group_id', group.id)
      members = (m ?? []).map((x: any) => x.profiles)
    }

    setData({ group, members, userId: user.id })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>
  return <GrupoClient {...data} onRefresh={load} />
}