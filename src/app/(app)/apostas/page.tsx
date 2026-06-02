'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import ApostasList from './ApostasList'

export default function ApostasPage() {
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const [{ data: matches }, { data: membership }] = await Promise.all([
      supabase.from('matches').select('*').order('kickoff_at'),
      supabase.from('group_members').select('group_id, groups(*)')
        .eq('user_id', user.id).order('joined_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const group = (membership as any)?.groups ?? null
    let bets: any[] = []
    if (group) {
      const { data: b } = await supabase.from('bets').select('*')
        .eq('user_id', user.id).eq('group_id', group.id)
      bets = b ?? []
    }

    setData({ matches: matches ?? [], group, bets, userId: user.id })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>
  return <ApostasList {...data} onRefresh={load} />
}