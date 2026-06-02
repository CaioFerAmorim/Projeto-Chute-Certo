'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

interface Member {
  id: string
  name: string
  avatar_url?: string
}

interface Props {
  group: { id: string; name: string; code: string; admin_id: string } | null
  members: Member[]
  userId: string
  onRefresh: () => void
}

function Avatar({ member, large = false }: { member: Member; large?: boolean }) {
  if (member?.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.name}
        className={large ? 'w-12 h-12 rounded-full object-cover flex-shrink-0' : 'w-8 h-8 rounded-full object-cover flex-shrink-0'}
      />
    )
  }
  return (
    <div className={large
      ? 'w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-sm font-medium text-green-700 flex-shrink-0'
      : 'w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-medium text-green-700 flex-shrink-0'
    }>
      {member?.name?.substring(0, 2).toUpperCase()}
    </div>
  )
}

export default function GrupoClient({ group, members, userId, onRefresh }: Props) {
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
      let g = null
      let attempts = 0
      while (!g && attempts < 5) {
        const code = genCode()
        const { data, error } = await supabase
          .from('groups').insert({ name: gName.trim(), code, admin_id: userId }).select().single()
        if (!error) { g = data; break }
        if (error.code !== '23505') throw error
        attempts++
      }
      if (!g) throw new Error('Erro ao gerar código único')
      await supabase.from('group_members').insert({ group_id: g.id, user_id: userId })
      flash('ok', 'Grupo criado!')
      onRefresh()
    } catch (e: any) { flash('err', e.message || 'Erro ao criar grupo') }
    finally { setLoading(false) }
  }

  async function joinGroup() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return flash('err', 'Digite o código')
    setLoading(true)
    try {
      const { data: g, error } = await supabase.from('groups').select('*').eq('code', code).maybeSingle()
      if (error || !g) throw new Error('Grupo não encontrado')
      const { error: joinErr } = await supabase.from('group_members').insert({ group_id: g.id, user_id: userId })
      if (joinErr && joinErr.code !== '23505') throw joinErr
      flash('ok', `Entrou no grupo ${g.name}!`)
      onRefresh()
    } catch (e: any) { flash('err', e.message || 'Erro ao entrar no grupo') }
    finally { setLoading(false) }
  }

  async function leaveGroup() {
    if (!group || !confirm('Tem certeza que quer sair do grupo?')) return
    await supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', userId)
    onRefresh()
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
        {msg && <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>{msg.text}</div>}

        <div className="card mb-4">
          <p className="sec-label">Seu grupo</p>
          <p className="font-medium text-lg mb-1">{group.name}</p>

          <div className="flex items-center gap-1 mb-3">
            {members.map(m => (
              <div key={m.id} title={m.name}>
                <Avatar member={m} />
              </div>
            ))}
            <span className="text-xs text-gray-400 ml-1">{members.length} membros</span>
          </div>

          <p className="text-xs text-gray-400 mb-1">Código de convite</p>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 font-mono text-xl font-medium tracking-widest bg-gray-50 rounded-lg px-4 py-2 text-center border border-gray-100">{group.code}</div>
            <button className="btn text-sm" onClick={copyCode}>{copied ? '✓ copiado' : 'copiar'}</button>
          </div>
          <button className="btn w-full text-gray-400 text-xs" onClick={leaveGroup}>Sair do grupo</button>
        </div>

        <div className="card">
          <p className="sec-label">Membros</p>
          <div className="space-y-1">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <Avatar member={m} large />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {m.name}
                    {m.id === userId && <span className="text-xs text-gray-400 font-normal ml-1">(você)</span>}
                  </p>
                </div>
                {group.admin_id === m.id && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">admin</span>
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
      {msg && <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>{msg.text}</div>}
      <div className="card mb-4">
        <p className="sec-label">Criar grupo</p>
        <input className="input mb-3" placeholder="Nome do grupo" value={gName} onChange={e => setGName(e.target.value)} />
        <button className="btn btn-primary w-full" onClick={createGroup} disabled={loading}>{loading ? 'Criando...' : 'Criar grupo'}</button>
      </div>
      <div className="card">
        <p className="sec-label">Entrar com código</p>
        <input className="input mb-3 uppercase tracking-widest font-mono" placeholder="ABC123" maxLength={6} value={joinCode} onChange={e => setJoinCode(e.target.value)} />
        <button className="btn w-full" onClick={joinGroup} disabled={loading}>{loading ? 'Entrando...' : 'Entrar no grupo'}</button>
      </div>
    </div>
  )
}