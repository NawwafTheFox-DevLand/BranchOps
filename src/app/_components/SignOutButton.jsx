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
        background: '#f0f2f6',
        border: '1px solid #c8cdd8',
        color: '#374151',
        padding: '8px 10px',
        borderRadius: 10,
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'inherit',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? '…' : label}
    </button>
  )
}
