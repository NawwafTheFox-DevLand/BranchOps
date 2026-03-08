'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

const C = {
  bg:'#f4f6f9', surf:'#ffffff', surf2:'#f0f2f6', surf3:'#e8ebf0',
  border:'#dde1e9', border2:'#c8cdd8',
  amber:'#d97706', amberDim:'rgba(217,119,6,0.08)', amberBrd:'rgba(217,119,6,0.25)',
  green:'#16a34a', greenDim:'rgba(22,163,74,0.07)', greenBrd:'rgba(22,163,74,0.2)',
  red:'#dc2626',   redDim:'rgba(220,38,38,0.07)',   redBrd:'rgba(220,38,38,0.2)',
  blue:'#2563eb',  blueDim:'rgba(37,99,235,0.07)',  blueBrd:'rgba(37,99,235,0.2)',
  teal:'#0d9488',  violet:'#7c3aed',
  muted:'#94a3b8', muted2:'#64748b', text:'#111827', textDim:'#374151',
}

function Input({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          background: '#1a1a1a',
          color: C.text,
          outline: 'none',
        }}
      />
    </label>
  )
}

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()

  const enableSignup = useMemo(() => {
    return String(process.env.NEXT_PUBLIC_ENABLE_SIGNUP || 'false').toLowerCase() === 'true'
  }, [])

  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  const nextPath = search.get('next') || '/'

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg(null)
    setLoading(true)

    try {
      const supabase = createClient()

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        })

        if (error) throw error

        setMsg({ type: 'success', text: 'Account created. Check email for confirmation (if enabled), then login.' })
        setMode('login')
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      router.replace(nextPath)
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Login failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Branch Ops MVP</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 18 }}>
          {mode === 'login' ? 'Sign in to continue' : 'Create an account (admin must assign a branch)'}
        </div>

        {msg && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.35)'}`,
              background: msg.type === 'success' ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
              color: msg.type === 'success' ? C.green : C.red,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {msg.text}
          </div>
        )}

        <form onSubmit={onSubmit}>
          {mode === 'signup' && (
            <Input label="Full name" value={fullName} onChange={setFullName} placeholder="e.g. Ahmed" />
          )}
          <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="name@company.com" />
          <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: 'none',
              background: loading ? '#2a2a2a' : C.amber,
              color: '#0a0a0a',
              fontWeight: 900,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {enableSignup && (
          <div style={{ marginTop: 14, fontSize: 12, color: C.muted }}>
            {mode === 'login' ? (
              <button
                onClick={() => setMode('signup')}
                style={{ background: 'none', border: 'none', color: C.amber, cursor: 'pointer', fontWeight: 700 }}
              >
                Create an account
              </button>
            ) : (
              <button
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: C.amber, cursor: 'pointer', fontWeight: 700 }}
              >
                Back to login
              </button>
            )}
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
          Tip: For a clean rollout, keep sign-up disabled and create users from Supabase Dashboard,
          then assign roles + branches in <code style={{ color: C.text }}>Admin → Users</code>.
        </div>
      </div>
    </div>
  )
}

import { Suspense } from 'react'
export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>}>
      <LoginForm />
    </Suspense>
  )
}
