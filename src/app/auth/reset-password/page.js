'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

const C = {
  surface:'#ffffff', border:'#dde1e9', border2:'#c8cdd8',
  amber:'#d97706', green:'#16a34a', greenDim:'rgba(22,163,74,0.07)',
  red:'#dc2626', redDim:'rgba(220,38,38,0.07)',
  muted:'#94a3b8', muted2:'#64748b', text:'#111827',
  surface2:'#f0f2f6',
}

function ResetForm() {
  const router = useRouter()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [msg, setMsg]             = useState(null)
  const [ready, setReady]         = useState(false)

  useEffect(() => {
    const supabase = createClient()
    // Supabase puts the token in the URL hash — getSession picks it up automatically
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      setMsg({ type: 'error', text: 'Passwords do not match' })
      return
    }
    if (password.length < 6) {
      setMsg({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMsg({ type: 'success', text: 'Password updated! Redirecting to login…' })
      setTimeout(() => router.replace('/login'), 2000)
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Failed to update password' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24, background: '#f4f6f9' }}>
      <div style={{ width: '100%', maxWidth: 420, background: C.surface,
        border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>

        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: C.text }}>
          Reset Password
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 24 }}>
          Enter your new password below.
        </div>

        {!ready && (
          <div style={{ padding: '12px', borderRadius: 10, background: '#fef3c7',
            border: '1px solid #fcd34d', color: '#92400e', fontSize: 12, marginBottom: 16 }}>
            Verifying your reset link…
          </div>
        )}

        {msg && (
          <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10,
            border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.35)'}`,
            background: msg.type === 'success' ? C.greenDim : C.redDim,
            color: msg.type === 'success' ? C.green : C.red,
            fontSize: 12, fontWeight: 600 }}>
            {msg.text}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6,
              letterSpacing: '0.08em', textTransform: 'uppercase' }}>New Password</div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" disabled={!ready || loading}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${C.border}`, background: C.surface2,
                color: C.text, outline: 'none', fontSize: 13 }} />
          </label>

          <label style={{ display: 'block', marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6,
              letterSpacing: '0.08em', textTransform: 'uppercase' }}>Confirm Password</div>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••" disabled={!ready || loading}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${C.border}`, background: C.surface2,
                color: C.text, outline: 'none', fontSize: 13 }} />
          </label>

          <button type="submit" disabled={!ready || loading}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12,
              border: 'none', background: !ready || loading ? '#e5e7eb' : C.amber,
              color: !ready || loading ? C.muted2 : '#0a0a0a',
              fontWeight: 900, fontSize: 14, cursor: !ready || loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Updating…' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', display:'flex',
      alignItems:'center', justifyContent:'center' }}>Loading…</div>}>
      <ResetForm />
    </Suspense>
  )
}
