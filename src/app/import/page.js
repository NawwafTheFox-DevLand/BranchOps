import { requireAdmin } from '@/lib/auth'
import ImportClient from './ImportClient'
import SignOutButton from '@/app/_components/SignOutButton'

export default async function ImportPage() {
  await requireAdmin()

  return (
    <div style={{ minHeight: '100vh', background: '#0e0e0e', color: '#e5e7eb', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Admin · Imports</div>
          <div style={{ fontSize: 12, color: 'rgba(229,231,235,0.65)' }}>Import Purchases.xlsx and Sales.xlsx into Supabase.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a
            href="/dashboard"
            style={{
              fontSize: 12,
              color: 'rgba(229,231,235,0.85)',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '8px 10px',
              borderRadius: 10,
              fontWeight: 700,
              background: 'rgba(0,0,0,0.3)',
            }}
          >
            Dashboard
          </a>
          <SignOutButton />
        </div>
      </div>

      <ImportClient />
    </div>
  )
}
