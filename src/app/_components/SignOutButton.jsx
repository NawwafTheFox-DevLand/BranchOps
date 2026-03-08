'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

export default function SignOutButton({ label = 'Sign out' }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onSignOut = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.replace('/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={onSignOut}
      disabled={loading}
      style={{
        background: 'none',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(229,231,235,0.9)',
        padding: '8px 10px',
        borderRadius: 10,
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {loading ? '…' : label}
    </button>
  )
}
