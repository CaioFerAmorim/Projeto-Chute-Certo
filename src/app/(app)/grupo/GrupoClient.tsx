'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

interface Props {
  group: { id: string; name: string; code: string; admin_id: string } | null
  members: { id: string; name: string; username: string }[]
  userId: string
}

function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function GrupoClient({ group, members, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [gName, setGName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function flash(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  async function createGroup() {
    if (!gName.trim()) return flash('err', 'Digite um nome para o grupo')
    setLoading(true)
    try {
      const code = genCode()
      const { data: g, error } = await supabase
        .from('groups')
        .insert({ name: gName.trim(), code, admin_id: userId })
        .select().single()
      if (error) throw error
      await supabase.from('group_members').insert({ group_id: g.id, user_id: userId })
      flash('ok', 'Grupo criado! Compartilhe o código com os amigos.')
      router.refresh()
    } catch { flash('err', 'Erro ao criar grupo') }
    finally { setLoading(false) }
  }

  async function joinGroup() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return flash('err', 'Digite o código')
    setLoading(true)
    try {
      const { data: g, error } = await supabase
        .from('groups').select('*').eq('code', code).maybeSingle()
      if (error || !g) throw new Error('Grupo não encontrado')
      const { error: joinErr } = await supabase
        .from('group_members').insert({ group_id: g.id, user_id: userId })
      if (joinErr && joinErr.code !== '23505') throw joinErr // 23505 = já é membro
      flash('ok', `Entrou no grupo ${g.name}!`)
      router.refresh()
    } catch (e: any) { flash('err', e.message || 'Erro ao entrar no grupo') }
    finally { setLoading(false) }
  }

  async function leaveGroup() {
    if (!group || !confirm('Tem certeza que quer sair do grupo?')) return
    await supabase.from('group_members')
      .delete().eq('group_id', group.id).eq('user_id', userId)
    router.refresh()
  }

  function copyCode() {
    if (!group) return
    navigator.clipboard.writeText(group.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (group) {
    return (
      <div className="px-4 py-4">
        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
            {msg.text}
          </div>
        )}
        <div className="card mb-4">
          <p className="sec-label">Seu grupo</p>
          <p className="font-medium text-lg mb-1">{group.name}</p>
          <p className="text-xs text-gray-400 mb-3">{members.length} membros</p>

          <p className="text-xs text-gray-400 mb-1">Código de convite</p>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 font-mono text-xl font-medium tracking-widest bg-gray-50 rounded-lg px-4 py-2 text-center border border-gray-100">
              {group.code}
            </div>
            <button className="btn text-sm" onClick={copyCode}>
              {copied ? '✓ copiado' : 'copiar'}
            </button>
          </div>

          <button className="btn w-full text-gray-400 text-xs" onClick={leaveGroup}>
            Sair do grupo
          </button>
        </div>

        <div className="card">
          <p className="sec-label">Membros</p>
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-medium text-green-700">
                  {m.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm">{m.name} {m.id === userId && <span className="text-xs text-gray-400">(você)</span>}</p>
                  <p className="text-xs text-gray-400">@{m.username}</p>
                </div>
                {group.admin_id === m.id && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">admin</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
          {msg.text}
        </div>
      )}
      <div className="card mb-4">
        <p className="sec-label">Criar grupo</p>
        <input className="input mb-3" placeholder="Nome do grupo" value={gName} onChange={e => setGName(e.target.value)} />
        <button className="btn btn-primary w-full" onClick={createGroup} disabled={loading}>
          {loading ? 'Criando...' : 'Criar grupo'}
        </button>
      </div>
      <div className="card">
        <p className="sec-label">Entrar com código</p>
        <input
          className="input mb-3 uppercase tracking-widest font-mono"
          placeholder="ABC123"
          maxLength={6}
          value={joinCode}
          onChange={e => setJoinCode(e.target.value)}
        />
        <button className="btn w-full" onClick={joinGroup} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar no grupo'}
        </button>
      </div>
    </div>
  )
}
