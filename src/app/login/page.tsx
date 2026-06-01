'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Register
  const [rName, setRName] = useState('')
  const [rUser, setRUser] = useState('')
  const [rEmail, setREmail] = useState('')
  const [rPass, setRPass] = useState('')

  // Login
  const [lEmail, setLEmail] = useState('')
  const [lPass, setLPass] = useState('')

  async function register() {
    setError(''); setLoading(true)
    try {
      const username = rUser.trim().toLowerCase().replace(/\s/g, '')
      if (!rName || !username || !rEmail || !rPass) throw new Error('Preencha todos os campos')
      if (rPass.length < 6) throw new Error('Senha precisa ter pelo menos 6 caracteres')

      // Checa se username já existe
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('username', username).maybeSingle()
      if (existing) throw new Error('Esse @usuário já está em uso')

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: rEmail.trim(),
        password: rPass,
      })
      if (signUpError) throw signUpError
      if (!data.user) throw new Error('Erro ao criar conta')

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username,
        name: rName.trim(),
      })
      if (profileError) throw profileError

      router.push('/apostas')
    } catch (e: any) {
      setError(e.message || 'Erro ao criar conta')
    } finally { setLoading(false) }
  }

  async function login() {
    setError(''); setLoading(true)
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: lEmail.trim(),
        password: lPass,
      })
      if (loginError) throw new Error('Email ou senha incorretos')
      router.push('/apostas')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="px-4 pb-8">
      {/* Header */}
      <div className="pt-12 pb-8 text-center">
        <div className="w-14 h-14 bg-green-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">⚽</span>
        </div>
        <h1 className="text-2xl font-medium tracking-tight">Chute Certo</h1>
        <p className="text-sm text-gray-400 mt-1">Bolão da Copa com os amigos</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-6">
        {(['register', 'login'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setError('') }}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${tab === t ? 'border-green-400 text-green-600' : 'border-transparent text-gray-400'}`}>
            {t === 'register' ? 'Criar conta' : 'Entrar'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
          {error}
        </div>
      )}

      {tab === 'register' ? (
        <div className="space-y-3">
          <input className="input" placeholder="Seu nome" value={rName} onChange={e => setRName(e.target.value)} />
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">@</span>
            <input className="input pl-6" placeholder="usuário" value={rUser} onChange={e => setRUser(e.target.value)} />
          </div>
          <input className="input" type="email" placeholder="Email" value={rEmail} onChange={e => setREmail(e.target.value)} />
          <input className="input" type="password" placeholder="Senha (mín. 6 caracteres)" value={rPass} onChange={e => setRPass(e.target.value)} />
          <button className="btn btn-primary w-full mt-2" onClick={register} disabled={loading}>
            {loading ? 'Criando...' : 'Criar conta'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input className="input" type="email" placeholder="Email" value={lEmail} onChange={e => setLEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Senha" value={lPass} onChange={e => setLPass(e.target.value)} />
          <button className="btn btn-primary w-full mt-2" onClick={login} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      )}
    </div>
  )
}
