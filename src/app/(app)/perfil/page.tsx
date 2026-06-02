'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { calcPoints } from '@/types'

export default function PerfilPage() {
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPass, setEditPass] = useState('')
  const [editPassConfirm, setEditPassConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const [{ data: profile }, { data: membership }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('group_members').select('group_id').eq('user_id', user.id)
        .order('joined_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const groupId = (membership as any)?.group_id ?? null
    let bets: any[] = [], matches: any[] = []
    let score = { points: 0, exact: 0, winner: 0, bets: 0 }

    if (groupId) {
      const [{ data: b }, { data: m }] = await Promise.all([
        supabase.from('bets').select('*').eq('user_id', user.id).eq('group_id', groupId),
        supabase.from('matches').select('*').order('kickoff_at'),
      ])
      bets = b ?? []; matches = m ?? []
      bets.forEach(bet => {
        const match = matches.find((m: any) => m.id === bet.match_id)
        if (!match) return
        score.bets++
        const pts = calcPoints(bet.home_goals, bet.away_goals, match.result_home, match.result_away)
        score.points += pts
        if (pts === 3) score.exact++
        if (pts === 1) score.winner++
      })
    }

    setData({ profile, score, bets, matches, groupId, userId: user.id, email: user.email })
    setEditName(profile?.name ?? '')
    setEditEmail(user.email ?? '')
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function flash(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const updates: any = {}
      if (editEmail !== data.email) updates.email = editEmail
      if (editPass) {
        if (editPass !== editPassConfirm) throw new Error('Senhas não coincidem')
        if (editPass.length < 6) throw new Error('Senha precisa ter pelo menos 6 caracteres')
        updates.password = editPass
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.auth.updateUser(updates)
        if (error) throw error
      }
      if (editName !== data.profile?.name) {
        const { error } = await supabase.from('profiles').update({ name: editName }).eq('id', data.userId)
        if (error) throw error
      }
      flash('ok', 'Perfil atualizado!')
      setEditing(false)
      setEditPass('')
      setEditPassConfirm('')
      load()
    } catch (e: any) {
      flash('err', e.message || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !data) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${data.userId}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const avatarUrl = urlData.publicUrl + '?t=' + Date.now()
      const { error: updateError } = await supabase.from('profiles')
        .update({ avatar_url: avatarUrl }).eq('id', data.userId)
      if (updateError) throw updateError
      flash('ok', 'Foto atualizada!')
      load()
    } catch (e: any) {
      flash('err', e.message || 'Erro ao enviar foto')
    } finally { setUploadingAvatar(false) }
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>

  const { profile, score, bets, matches, groupId } = data
  const finishedMatches = matches.filter((m: any) => m.result_home !== null)
  const avatarUrl = profile?.avatar_url

  return (
    <div className="px-4 py-4">
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
          {msg.text}
        </div>
      )}

      {/* Avatar + nome */}
      <div className="card mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-shrink-0">
            <div
              className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-xl font-medium text-green-700 overflow-hidden cursor-pointer"
              onClick={() => fileRef.current?.click()}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : <span>{profile?.name?.substring(0, 2).toUpperCase()}</span>}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-5 h-5 bg-green-400 rounded-full flex items-center justify-center text-white text-xs">
              {uploadingAvatar ? '…' : '✏️'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          </div>
          <div className="flex-1">
            <p className="font-medium text-base">{profile?.name}</p>
            <p className="text-xs text-gray-400">{data.email}</p>
          </div>
          <button
            className="btn btn-sm text-xs"
            onClick={() => setEditing(!editing)}>
            {editing ? 'Cancelar' : 'Editar'}
          </button>
        </div>

        {/* Formulário de edição */}
        {editing && (
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400 mb-1">Nome</p>
              <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Email</p>
              <input className="input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Nova senha (deixe em branco para não alterar)</p>
              <input className="input mb-2" type="password" placeholder="Nova senha" value={editPass} onChange={e => setEditPass(e.target.value)} />
              <input className="input" type="password" placeholder="Confirmar nova senha" value={editPassConfirm} onChange={e => setEditPassConfirm(e.target.value)} />
            </div>
            <button className="btn btn-primary w-full" onClick={saveProfile} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { n: score.points, l: 'pontos totais' },
          { n: score.bets,   l: 'apostas feitas' },
          { n: score.exact,  l: 'placares exatos' },
          { n: score.winner, l: 'vencedores certos' },
        ].map(s => (
          <div key={s.l} className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-medium">{s.n}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Resultados */}
      {finishedMatches.length > 0 && (
        <div className="card mb-4">
          <p className="sec-label">Meus resultados</p>
          {finishedMatches.map((m: any) => {
            const bet = bets.find((b: any) => b.match_id === m.id)
            const pts = bet ? calcPoints(bet.home_goals, bet.away_goals, m.result_home, m.result_away) : null
            return (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                <div className="flex items-center gap-2">
                  <span>{m.home_flag}{m.away_flag}</span>
                  <span className="text-gray-500 text-xs">{m.home_name} × {m.away_name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400">{bet ? `${bet.home_goals}×${bet.away_goals}` : '—'}</span>
                  {pts !== null
                    ? <span className={pts === 3 ? 'pts-exact' : pts === 1 ? 'pts-winner' : 'pts-zero'}>{pts > 0 ? `+${pts}` : '0'}</span>
                    : <span className="pts-zero">—</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Regras */}
      <div className="card mb-4">
        <p className="sec-label">Regras de pontuação</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">🎯 Placar exato</span><span className="font-medium text-green-700">3 pts</span></div>
          <div className="flex justify-between"><span className="text-gray-500">✓ Vencedor / empate</span><span className="font-medium text-amber-600">1 pt</span></div>
          <div className="flex justify-between"><span className="text-gray-500">✗ Errou</span><span className="text-gray-400">0 pts</span></div>
          <div className="pt-2 border-t border-gray-100 text-xs text-gray-400">🔒 Apostas fecham no minuto em que o jogo começa</div>
        </div>
      </div>

      <button className="btn w-full text-gray-400 text-sm" onClick={logout}>Sair da conta</button>
    </div>
  )
}