'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

function generateUsername(name: string): string {
  const base = name.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 20)
  return base + Math.floor(Math.random() * 900 + 100)
}

export default function LoginPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [rName, setRName] = useState('')
  const [rEmail, setREmail] = useState('')
  const [rPass, setRPass] = useState('')
  const [lEmail, setLEmail] = useState('')
  const [lPass, setLPass] = useState('')

  async function register() {
    setError(''); setLoading(true)
    try {
      if (!rName || !rEmail || !rPass) throw new Error('Preencha todos os campos')
      if (rPass.length < 6) throw new Error('Senha precisa ter pelo menos 6 caracteres')
      const username = generateUsername(rName)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: rEmail.trim(),
        password: rPass,
        options: { data: { name: rName.trim(), username } }
      })
      if (signUpError) throw signUpError
      if (!data.user) throw new Error('Erro ao criar conta')
      window.location.href = '/apostas'
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
      window.location.href = '/apostas'
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="px-4 pb-8">
      <div className="pt-12 pb-8 text-center">
        <img src="/icone.png" alt="Chute Certo" className="w-14 h-14 rounded-full mx-auto mb-3" />
        <h1 className="text-2xl font-medium tracking-tight">Chute Certo</h1>
        <p className="text-sm text-gray-400 mt-1">Bolão da Copa com os amigos</p>
      </div>

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